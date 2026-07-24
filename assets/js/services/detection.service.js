import { logError, validateModelMetadata } from '../core/utils.js';

class DetectionService {
	constructor() {
		this.model = null;
		this.labels = [];
		this.metadata = null;
		this.imageSize = 224;
	}

	async loadModel() {
		try {
			if (typeof tf === 'undefined') {
				throw new Error('TensorFlow.js belum dimuat. Periksa script CDN pada index.html.');
			}

			await tf.ready();
			const [model, metadata] = await Promise.all([
				tf.loadLayersModel('./model/model.json'),
				fetch('./model/metadata.json').then((response) => {
					if (!response.ok) throw new Error(`metadata.json gagal dimuat (${response.status})`);
					return response.json();
				})
			]);

			if (!validateModelMetadata(metadata)) {
				throw new Error('Metadata model tidak valid: labels tidak ditemukan.');
			}

			this.model = model;
			this.metadata = metadata;
			this.labels = metadata.labels;
			this.imageSize = metadata.imageSize || 224;
			return true;
		} catch (error) {
			logError('Failed to load model', error);
			throw new Error(`Failed to load model: ${error.message}`);
		}
	}

	async predict(imageElement) {
		let imageTensor;
		let batchedTensor;
		let predictions;

		try {
			if (!this.isLoaded()) {
				throw new Error('Model belum dimuat');
			}

			imageTensor = tf.browser
				.fromPixels(imageElement)
				.resizeBilinear([this.imageSize, this.imageSize])
				.toFloat()
				.div(255);
			batchedTensor = imageTensor.expandDims(0);
			predictions = this.model.predict(batchedTensor);
			const scores = await predictions.data();
			let bestIndex = 0;
			let bestScore = scores[0] || 0;

			for (let index = 1; index < scores.length; index += 1) {
				if (scores[index] > bestScore) {
					bestScore = scores[index];
					bestIndex = index;
				}
			}

			const confidence = Number((bestScore * 100).toFixed(2));
			return {
				className: this.labels[bestIndex] || 'Unknown',
				confidence,
				isValid: confidence >= 1,
				raw: Array.from(scores).map((score, index) => ({
					className: this.labels[index] || `Class ${index}`,
					confidence: Number((score * 100).toFixed(2))
				}))
			};
		} catch (error) {
			logError('Prediction error', error);
			throw new Error(`Prediksi gagal: ${error.message}`);
		} finally {
			if (predictions) predictions.dispose();
			if (batchedTensor) batchedTensor.dispose();
			if (imageTensor) imageTensor.dispose();
		}
	}

	isLoaded() {
		return Boolean(this.model && this.labels.length > 0);
	}
}

export default DetectionService;
