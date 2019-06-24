import playerElement from '../template/player.html'
import Template from './template'
import Bar from './bar'
import { secondToTime, carousel, numToString, handleOptions, handleAudios } from '../utils'

let interval
const isMobile = /mobile/i.test(window.navigator.userAgent)
const dragStart = isMobile ? 'touchstart' : 'mousedown'
const dragMove = isMobile ? 'touchmove' : 'mousemove'
const dragEnd = isMobile ? 'touchend' : 'mouseup'
const pressSpace = (e) => {
  if (e.keyCode === 32) {
    this.toggle()
  }
}

class Player {
  constructor(options) {
    this.options = handleOptions(options)
    this.init = false
    this.player = document.getElementsByClassName('shk')[0]
    this.muted = this.options.muted
    this.initUI()
    this.initKeyEvents()
    this.dragging = false
    this.currentSpeed = 1
    this.currentTime = 0
  }

  get duration() {
    if (!this.audio) {
      // what if audio is an array
      return this.options.audio[0].duration
    } else {
      return isNaN(this.audio.duration) ? 0 : this.audio.duration
    }
  }

  initUI() {
    this.player.innerHTML = playerElement
    const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color')
    this.player.style.boxShadow = `0px 0px 14px 6px ${themeColor}20`
    this.template = new Template(this.player, this.options.audio[0], themeColor)
    this.bar = new Bar(this.template)

    const titleOverflow = this.template.title.offsetWidth - this.template.texts.offsetWidth
    if (titleOverflow > 0) {
      interval = carousel(this.template.title, -titleOverflow)
    }
    if (this.template.subtitle.offsetWidth > this.template.texts.offsetWidth) {}
    this.initOptions()
    this.initButtons()
    this.initBar()
  }

  initOptions() {
    if (this.options.fixed) {
      if (this.options.fixed.value) {
        this.player.classList.add('Fixed')
      }
      if (this.options.fixed.position === 'top') {
        this.player.classList.add('Top')
      }
    }
    if (this.options.muted) {
      this.player.classList.add('Mute')
    }
    this.options.autoPlay ? this.player.classList.add('Play') : this.player.classList.add('Pause')
  }

  initButtons() {
    this.template.playBtn.addEventListener('click', () => {
      this.toggle()
    })
    this.template.muteBtn.addEventListener('click', () => {
      this.muted = !this.muted
      this.player.classList.toggle('Mute')
      if (this.audio) {
        this.audio.muted = this.muted
      }
    })
    this.template.fwdBtn.addEventListener('click', () => {
      const time = Math.min(this.duration, this.currentTime + 10)
      this.seek(time)
    })
    this.template.bwdBtn.addEventListener('click', () => {
      const time = Math.max(0, this.currentTime - 10)
      this.seek(time)
    })
    this.template.speedBtn.addEventListener('click', () => {
      const index = this.options.speedOptions.indexOf(this.currentSpeed)
      this.currentSpeed = (index + 1 >= this.options.speedOptions.length) ? this.options.speedOptions[0] : this.options.speedOptions[index + 1]
      this.template.speedBtn.innerHTML = numToString(this.currentSpeed) + 'x'
      if(this.audio) {
        this.audio.playbackRate = this.currentSpeed
      }
    })
  }

  initBar() {
    const dragStartHandler = () => {
      this.player.classList.add('Seeking')
      this.dragging = true
      document.addEventListener(dragMove, dragMoveHandler)
      document.addEventListener(dragEnd, dragEndHandler)
    }

    const dragMoveHandler = (e) => {
      let percentage = ((e.clientX || e.changedTouches[0].clientX) - this.template.barWrap.getBoundingClientRect().left) / this.template.barWrap.clientWidth
      percentage = Math.min(percentage, 1)
      percentage = Math.max(0, percentage)
      this.bar.set('audioPlayed', percentage)
      this.currentTime = percentage * this.duration
      this.template.currentTime.innerHTML = secondToTime(this.currentTime)
    }

    const dragEndHandler = (e) => {
      this.dragging = false
      this.player.classList.remove('Seeking')
      this.seek(this.currentTime)
      document.removeEventListener(dragMove, dragMoveHandler)
      document.removeEventListener(dragEnd, dragEndHandler)
    }

    const instantSeek = (e) => {
      if (this.dragging) return
      dragMoveHandler(e)
      this.seek(this.currentTime)
    }
    this.template.barWrap.addEventListener(dragEnd, instantSeek)
    this.template.handle.addEventListener(dragStart, dragStartHandler)
  }

  initKeyEvents() {
    document.addEventListener('keyup', pressSpace)
  }

  initAudio() {
    if (this.options.audio.length) {
      this.audio = new Audio()
      this.updateAudio(this.options.audio[0].src)

      this.initLoadingEvents()
      this.initAudioEvents()

      this.inited = true
    }
  }

  initAudioEvents() {
    this.audio.addEventListener('play', () => {
      if (this.player.classList.contains('Pause')) {
        this.setUIPlaying()
      }
    })
    this.audio.addEventListener('pause', () => {
      if (this.player.classList.contains('Pause')) {
        this.setUIPaused()
      }
    })
    this.audio.addEventListener('ended', () => {
      this.setUIPaused()
      this.seek(0)
    })
    this.audio.addEventListener('durationchange', () => {
      // Android browsers will output 1 at first
      if (this.duration !== 1) {
        this.template.duration.innerHTML = secondToTime(this.duration)
      }
    })
    this.audio.addEventListener('progress', () => {
      if (this.audio.buffered.length) {
        const percentage = this.audio.buffered.length ? this.audio.buffered.end(this.audio.buffered.length - 1) / this.duration : 0
        this.bar.set('audioLoaded', percentage)
      }
    })
    this.audio.addEventListener('timeupdate', () => {
      if (this.dragging) return
      if (Math.floor(this.currentTime) !== Math.floor(this.audio.currentTime)) {
        this.template.currentTime.innerHTML = secondToTime(this.audio.currentTime)
        this.currentTime = +this.audio.currentTime
        const percentage = this.audio.currentTime ? this.audio.currentTime / this.duration : 0
        this.bar.set('audioPlayed', percentage)
      }
    })
  }

  initLoadingEvents() {
    this.audio.addEventListener('canplay', () => {
      if (this.player.classList.contains('Loading')) {
        this.player.classList.remove('Loading')
      }
    })
    this.audio.addEventListener('canplaythrough', () => {
      if (this.player.classList.contains('Loading'))
        this.player.classList.remove('Loading')
    })
    this.audio.addEventListener('loadstart', () => {
      if (!this.player.classList.contains('Loading')) {
        this.player.classList.add('Loading')
      }
    })
    this.audio.addEventListener('waiting', () => {
      if (!this.player.classList.contains('Loading')) {
        this.player.classList.add('Loading')
      }
    })
  }


  setUIPlaying() {
    this.player.classList.add('Play')
    this.player.classList.remove('Pause')
  }

  setUIPaused() {
    this.player.classList.add('Pause')
    this.player.classList.remove('Play')
    this.player.classList.remove('Loading')
  }

  play(audio) {
    if (!this.inited) {
      this.initAudio()
    }
    if (audio && audio.src) {
      this.template.update(audio)
      //audio = handleAudios(audio)
      this.currentTime = 0
      this.updateAudio(audio.src)
    }
    if (!this.audio.paused) return
    this.setUIPlaying()
    setTimeout(() => {
      this.audio.play()
    }, 500)
  }

  pause() {
    if (!this.inited) {
      this.initAudio()
    }
    if (this.audio.paused) return
    this.setUIPaused()
    this.audio.pause()
  }

  toggle() {
    if (!this.inited) {
      this.initAudio()
    }
    if (this.audio) {
      this.audio.paused ? this.play() : this.pause()
    }
  }

  seek(time) {
    time = Math.min(time, this.duration)
    time = Math.max(time, 0)
    this.template.currentTime.innerHTML = secondToTime(time)
    if (this.audio) {
      this.audio.currentTime = time
    } else {
      this.currentTime = time
    }
  }

  updateAudio(src) {
    this.audio.src = src
    this.audio.preload = this.options.preload
    this.audio.autoplay = this.options.autoPlay
    this.audio.muted = this.muted
    this.audio.currentTime = this.currentTime
    this.audio.playbackRate = this.currentSpeed
    console.log(src, this.audio)
  }

  destroy() {
    this.audio.pause()
    this.audio.src = ''
    this.audio.load()
    this.audio = null
    clearInterval(interval)
    document.removeEventListener('keyup', pressSpace)
  }
}

export default Player

