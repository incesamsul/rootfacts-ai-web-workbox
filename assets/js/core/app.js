import UIHandler from '../ui/ui.handler.js';
import DetectionService from '../services/detection.service.js';
import CameraService from '../services/camera.service.js';
import FunFactService from '../services/facts.service.js';
import { APP_CONFIG } from './config.js';
import { createDelay, isValidDetection, logError } from './utils.js';

class RootFactsApp {
	constructor() {
		this.detector = new DetectionService();
		this.camera = null;
		this.funFactGenerator = new FunFactService();
		this.ui = new UIHandler();
		this.isRunning = false;
		this.currentLoopId = null;
		this.config = APP_CONFIG;
		this.currentFunFact = '';
		this.currentTone = 'normal';
		this.currentFPS = 30;

		this.ui.disableButton();
		this.bindEvents();
		this.init();
		this.registerServiceWorker();
	}

	bindEvents() {
		this.ui.bindEvents({
			onToggleCamera: () => this.toggleCamera(),
			onCameraChange: () => this.onCameraChange(),
			onFPSChange: (fps) => this.onFPSChange(fps),
			onCopy: () => this.onCopy(),
			onToneChange: (tone) => this.onToneChange(tone)
		});
	}
	
	async init() {
		try {
			this.ui.updateHeaderStatus('Memuat model...', true);
			await Promise.all([
				this.detector.loadModel(),
				this.funFactGenerator.loadModel()
			]);
			this.camera = new CameraService();
			this.ui.updateHeaderStatus('Siap', false);
			this.ui.enableButton();
		} catch (error) {
			logError('Gagal menginisialisasi aplikasi', error);
			this.ui.updateHeaderStatus('Error', false);
			this.ui.showError(`Gagal menginisialisasi: ${error.message}`);
			this.ui.disableButton();
		}
	}

	async registerServiceWorker() {
		if (!('serviceWorker' in navigator)) return;
		try {
			await navigator.serviceWorker.register('./sw.js');
		} catch (error) {
			logError('Service worker gagal didaftarkan', error);
		}
	}

	async onCopy() {
		const text = this.ui.getFunFactText();
		if (!text) return;
		try {
			await navigator.clipboard.writeText(text);
			this.ui.setCopyButtonCopied();
			setTimeout(() => this.ui.resetCopyButton(), 1500);
		} catch (error) {
			logError('Gagal menyalin fun fact', error);
		}
	}

	onToneChange(tone) {
		this.currentTone = tone;
	}

	onFPSChange(fps) {
		this.currentFPS = fps;
		this.camera?.setFPS(fps);
	}

	async onCameraChange() {
		if (!this.isRunning) return;
		await this.startCamera();
	}

	toggleCamera() {
		if (this.isRunning) {
			this.stopCamera();
		} else {
			this.startCamera();
		}
	}

	async startCamera() {
		try {
			const cameraSelect = this.ui.cameraSelect?.value;
			const facingMode = cameraSelect === 'front' ? 'user' : 'environment';
			await this.camera.startCamera({ facingMode, fps: this.currentFPS });
			this.ui.updateCameraUI(true);
			this.startDetection();
		} catch (error) {
			this.isRunning = false;
			this.ui.updateCameraUI(false);
			this.ui.showError(error.message);
		}
	}

	stopCamera() {
		this.stopDetection();
		this.camera?.stopCamera();
		this.ui.updateCameraUI(false);
		this.ui.switchToState('idle');
	}

	startDetection() {
		this.isRunning = true;
		const loopId = crypto.randomUUID();
		this.currentLoopId = loopId;
		this.ui.switchToState('loading');
		this.detectLoop(loopId);
	}

	stopDetection() {
		this.isRunning = false;
		this.currentLoopId = null;
	}

	async detectLoop(loopId) {
		while (this.isRunning && this.currentLoopId === loopId) {
			try {
				if (!this.camera.isReady()) {
					await createDelay(this.config.detectionRetryInterval);
					continue;
				}

				const detectionResult = await this.detector.predict(this.camera.video);
				if (isValidDetection(detectionResult)) {
					this.stopDetection();
					await this.generateAndShowResults(detectionResult);
					return;
				}
			} catch (error) {
				logError('Deteksi gagal', error);
			}

			await createDelay(Math.max(1000 / this.currentFPS, this.config.detectionRetryInterval));
		}
	}

	async generateAndShowResults(detectionResult) {
		try {
			this.ui.showResults(detectionResult, null);
			this.ui.updateFunFactState('loading');
			const funFact = await this.funFactGenerator.generateFunFact(detectionResult.className, this.currentTone);
			this.currentFunFact = funFact.funFact;
			this.ui.showResults(detectionResult, funFact);
			this.ui.updateHeaderStatus('Hasil ditemukan', false);
		} catch (error) {
			logError('Gagal menampilkan hasil', error);
			this.ui.updateFunFactState('error');
		}
	}
}

document.addEventListener('DOMContentLoaded', () => {
	new RootFactsApp();

	if (typeof lucide !== 'undefined') {
		lucide.createIcons();
	}
});

export default RootFactsApp;
