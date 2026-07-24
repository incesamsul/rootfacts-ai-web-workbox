import {
	getCameraErrorMessage,
	logError
} from '../core/utils.js';

class CameraService {
	constructor() {
		this.stream = null;
		this.video = null;
		this.canvas = null;
		this.config = { facingMode: 'environment', fps: 30 };

		this.initializeElements();
		this.init();
	}

	initializeElements() {
		this.video = document.getElementById('videoElement');
		this.canvas = document.getElementById('canvasElement');
		if (!this.video || !this.canvas) {
			throw new Error('Elemen video atau canvas tidak ditemukan');
		}
	}

	async init() {
		await this.loadCameras();
	}

	async loadCameras() {
		try {
			if (!navigator.mediaDevices?.enumerateDevices) return [];
			const devices = await navigator.mediaDevices.enumerateDevices();
			return devices.filter((device) => device.kind === 'videoinput');
		} catch (error) {
			logError('Gagal memuat kamera', error);
			throw new Error(`Akses kamera gagal: ${error.message}`);
		}
	}

	async startCamera({ facingMode = this.config.facingMode, fps = this.config.fps } = {}) {
		try {
			this.stopCamera();
			this.config.facingMode = facingMode;
			this.config.fps = fps;

			const constraints = {
				video: {
					facingMode,
					width: { ideal: 640 },
					height: { ideal: 640 },
					frameRate: { ideal: fps, max: fps }
				},
				audio: false
			};

			this.stream = await navigator.mediaDevices.getUserMedia(constraints);
			this.video.srcObject = this.stream;
			await this.video.play();
			return this.stream;
		} catch (error) {
			logError('Gagal memulai kamera', error);
			const errorMessage = getCameraErrorMessage(error);
			throw new Error(errorMessage);
		}
	}

	stopCamera() {
		if (this.stream) {
			this.stream.getTracks().forEach((track) => track.stop());
			this.stream = null;
		}
		if (this.video) {
			this.video.pause();
			this.video.srcObject = null;
		}
	}

	setFPS(fps) {
		this.config.fps = fps;
		const [track] = this.stream?.getVideoTracks?.() || [];
		if (track?.applyConstraints) {
			track.applyConstraints({ frameRate: { ideal: fps, max: fps } }).catch((error) => {
				logError('Gagal mengatur FPS', error);
			});
		}
	}

	isActive() {
		return Boolean(this.stream?.active);
	}

	isReady() {
		return Boolean(this.video && this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA);
	}
}

export default CameraService;
