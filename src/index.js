import Encoder from './encoder';
import EventEmitter from 'event-emitter';

class MicRecorder {
    constructor(config) {
        this.config = {
            // 128 or 160 kbit/s – mid-range bitrate quality
            bitRate: 128,

            // There is a known issue with some macOS machines, where the recording
            // will sometimes have a loud 'pop' or 'pop-click' sound. This flag
            // prevents getting audio from the microphone a few milliseconds after
            // the begining of the recording. It also helps to remove the mouse
            // "click" sound from the output mp3 file.
            startRecordingAt: 300,
            deviceId: null,
            enableAnalyser: true,
            lengthAnalyser: 32,
            ...config,
        };

        this.activeStream = null;
        this.context = null;
        this.microphone = null;
        this.processor = null;
        this.analyser = null;
        this.startTime = 0;
        this.isPause = false;
        this.analyserArray = new Uint8Array(this.config.lengthAnalyser);
    }

    addMicrophoneListener(stream) {
        this.activeStream = stream;

        this.initMicrophone();
        this.initAnalyser();
    };

    initMicrophone() {
        // This prevents the weird noise once you start listening to the microphone
        this.timerToStart = setTimeout(() => {
            delete this.timerToStart;
        }, this.config.startRecordingAt);

        // Set up Web Audio API to process data from the media stream (microphone).
        this.microphone = this.context.createMediaStreamSource(this.activeStream);

        // Settings a bufferSize of 0 instructs the browser to choose the best bufferSize
        this.processor = this.context.createScriptProcessor(0, 1, 1);

        // Add all buffers from LAME into an array.
        this.processor.onaudioprocess = (event) => {
            if (this.timerToStart) return;
            if (this.isPause) return;

            this.emit('processor.onaudioprocess', event);

            // Send microphone data to LAME for MP3 encoding while recording.
            this.lameEncoder.encode(event.inputBuffer.getChannelData(0));
        };

        // Begin retrieving microphone data.
        this.microphone.connect(this.processor);
        this.processor.connect(this.context.destination);
    }

    initAnalyser() {
        if (!this.config.enableAnalyser) return;

        this.analyser = this.context.createAnalyser();
        this.microphone.connect(this.analyser);
        this.loopAnalyser();
        this.loopAnalyserSecond();
    }

    loopAnalyser() {
        this.analyserRequestAnimationFrame = window.requestAnimationFrame(this.loopAnalyser.bind(this))

        if (this.isPause) return;
        this.analyser.getByteFrequencyData(this.analyserArray);
        this.emit('analyser', this.analyserArray);
    }

    loopAnalyserSecond() {
        this.analyserTimeout = setTimeout(this.loopAnalyserSecond.bind(this), 100);

        if (this.isPause) return;
        this.analyser.getByteFrequencyData(this.analyserArray);
        this.emit('analyser_second', this.analyserArray);
    }

    stop() {
        if (this.processor && this.microphone) {
            // Clean up the Web Audio API resources.
            this.microphone.disconnect();
            this.processor.disconnect();
            window.cancelAnimationFrame(this.analyserRequestAnimationFrame);
            window.clearTimeout(this.analyserTimeout);

            // If all references using this.context are destroyed, context is closed
            // automatically. DOMException is fired when trying to close again
            if (this.context && this.context.state !== 'closed') {
                this.context.close();
            }

            this.processor.onaudioprocess = null;

            // Stop all audio tracks. Also, removes recording icon from chrome tab
            this.activeStream.getAudioTracks().forEach(track => track.stop());

            this.emit('stop');
        }

        return this;
    };

    start() {
        this.isPause = false;
        this.stop();

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.context = new AudioContext();
        this.config.sampleRate = this.context.sampleRate;
        this.lameEncoder = new Encoder(this.config);

        const audio = this.config.deviceId ? { deviceId: { exact: this.config.deviceId } } : true;

        return new Promise((resolve, reject) => {
            navigator.mediaDevices
                .getUserMedia({ audio })
                .then(stream => {
                    this.emit('start', stream);
                    this.addMicrophoneListener(stream);
                    resolve(stream);
                })
                .catch(function(err) {
                    reject(err);
                });
        })
    };

    pause() {
        this.isPause = !this.isPause;
    };

    getMp3() {
        const finalBuffer = this.lameEncoder.finish();

        return new Promise((resolve, reject) => {
            if (finalBuffer.length === 0) {
                reject(new Error('No buffer to send'));
            } else {
                resolve([finalBuffer, new Blob(finalBuffer, { type: 'audio/mp3' })]);
                this.lameEncoder.clearBuffer();
            }
        });
    };

    async getFile(type, name = 'test') {
        switch (type) {
            case 'mp3': {
                const [buffer, blob] = await this.getMp3();
                const file = new File(buffer, `${name}.mp3`, {
                    type: blob.type,
                    lastModified: Date.now()
                });
                const url = URL.createObjectURL(file);
                const audio = new Audio(url);

                return {
                    file: file,
                    audio: audio,
                    url: url,
                };
            }
            default: return false;
        }
    };

    download(url) {
        const a = document.createElement('a');
        a.href = url;
        a.download = 'test_file.mp3';
        a.click();
    }
}

for (let key in EventEmitter.methods) {
    MicRecorder.prototype[key] = EventEmitter.methods[key];
}

window.MicRecorder = MicRecorder;

export default MicRecorder;