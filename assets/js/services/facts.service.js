import { logError } from '../core/utils.js';

const GENERATION_TASK = 'text2text-generation';
const GENERATION_MODEL = 'Xenova/flan-t5-small';
const TONE_INSTRUCTIONS = {
	normal: 'clear and factual',
	funny: 'light and playful',
	professional: 'professional and nutrition-focused',
	casual: 'casual and friendly'
};

class FunFactService {
	constructor() {
		this.generator = null;
		this.isModelLoaded = false;
		this.isGenerating = false;
		this.currentBackend = 'not-loaded';
	}

	async loadModel() {
		try {
			const transformers = globalThis.transformers;
			if (!transformers?.pipeline) {
				throw new Error('Transformers.js belum tersedia');
			}

			if (transformers.env) {
				transformers.env.allowLocalModels = false;
				transformers.env.useBrowserCache = true;
			}

			this.generator = await transformers.pipeline(GENERATION_TASK, GENERATION_MODEL);
			this.currentBackend = `transformers-js:${GENERATION_MODEL}`;
			this.isModelLoaded = true;
			return true;
		} catch (error) {
			this.generator = null;
			this.isModelLoaded = false;
			this.currentBackend = 'load-error';
			logError('Gagal memuat model Generative AI Transformers.js', error);
			throw new Error(`Model Generative AI gagal dimuat: ${error.message}`);
		}
	}

	sanitizeVegetableName(vegetable) {
		return vegetable
			.replace(/[^a-zA-Z\s-]/g, '')
			.trim()
			.slice(0, 32);
	}

	buildPrompt(vegetable, tone) {
		const style = TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS.normal;
		return `Topic: ${vegetable}. Write one short, original, ${style} fun fact about this vegetable.`;
	}

	extractGeneratedText(result) {
		const first = Array.isArray(result) ? result[0] : result;
		return (first?.generated_text || first?.summary_text || first?.text || '').trim();
	}

	async generateFunFact(vegetable, tone = 'normal') {
		if (!this.isReady()) {
			throw new Error('Model Generative AI belum siap atau sedang menghasilkan fakta');
		}

		const cleanVegetable = this.sanitizeVegetableName(vegetable || '');
		if (!cleanVegetable) {
			throw new Error('Nama sayuran yang valid diperlukan');
		}

		this.isGenerating = true;
		try {
			const prompt = this.buildPrompt(cleanVegetable, tone);
			const result = await this.generator(prompt, {
				max_new_tokens: 48,
				temperature: 0.7,
				do_sample: false
			});

			const generatedText = this.extractGeneratedText(result);
			if (!generatedText) {
				throw new Error('Model tidak menghasilkan teks');
			}

			return {
				funFact: generatedText,
				source: this.currentBackend,
				prompt
			};
		} catch (error) {
			logError('Error generating fun fact with Transformers.js', error);
			throw new Error(`Fun fact gagal dibuat oleh model Generative AI: ${error.message}`);
		} finally {
			this.isGenerating = false;
		}
	}

	isReady() {
		return this.isModelLoaded && Boolean(this.generator) && !this.isGenerating;
	}
}

export default FunFactService;
