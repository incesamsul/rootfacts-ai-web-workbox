import { logError } from '../core/utils.js';

const GENERATION_TASK = 'text2text-generation';
const GENERATION_MODEL = 'Xenova/LaMini-Flan-T5-248M';
const TONE_INSTRUCTIONS = {
	normal: 'useful nutrition or cooking',
	funny: 'useful playful food',
	professional: 'nutrition-focused',
	casual: 'simple food'
};

const GENERATION_OPTIONS = {
	max_new_tokens: 40,
	do_sample: false,
	num_beams: 2,
	early_stopping: true,
	repetition_penalty: 1.15,
	no_repeat_ngram_size: 3,
	temperature: 0.2,
	top_p: 0.85
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

	sanitizeDetectedLabel(label) {
		return String(label || '')
			.replace(/[_/]+/g, ' ')
			.replace(/[^a-zA-Z\s-]/g, '')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, 48);
	}

	buildPrompt(label, tone) {
		const style = TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS.normal;
		return `Question: What is one ${style} fact about ${label}? Answer:`;
	}

	buildRetryPrompt(label) {
		return `Question: How is ${label} useful in food or nutrition? Answer:`;
	}

	extractGeneratedText(result) {
		const first = Array.isArray(result) ? result[0] : result;
		return (first?.generated_text || first?.summary_text || first?.text || '').trim();
	}

	cleanGeneratedFact(text, label) {
		const cleaned = text
			.replace(/^\s*(answer|fakta|fun fact|topic)\s*:?\s*/i, '')
			.replace(/\s+/g, ' ')
			.trim()
			.replace(/^['\"]|['\"]$/g, '');

		const firstSentence = (cleaned.match(/^.*?[.!?](\s|$)/)?.[0] || cleaned).trim();
		const bounded = firstSentence.split(/\s+/).slice(0, 22).join(' ');
		return `Tentang ${label}: ${bounded}`;
	}

	containsLabel(text, label) {
		const normalizedText = text.toLowerCase();
		return label
			.toLowerCase()
			.split(/\s+/)
			.filter((token) => token.length >= 3)
			.some((token) => normalizedText.includes(token));
	}

	isWeakFact(text, label) {
		const normalizedText = text.toLowerCase();
		const normalizedLabel = label.toLowerCase();
		const words = normalizedText.split(/\s+/).filter(Boolean);
		const uniqueWords = new Set(words);
		const tooRepetitive = words.length > 4 && uniqueWords.size / words.length < 0.55;
		const onlyDefinition = new RegExp(`${normalizedLabel}s?\\s+(is|are|adalah)\\s+(a\\s+)?(vegetable|food|sayuran)\\.?$`).test(normalizedText);
		return tooRepetitive || onlyDefinition;
	}

	async generateWithPrompt(prompt) {
		const result = await this.generator(prompt, GENERATION_OPTIONS);
		return this.extractGeneratedText(result);
	}

	async generateFunFact(detectedLabel, tone = 'normal') {
		if (!this.isReady()) {
			throw new Error('Model Generative AI belum siap atau sedang menghasilkan fakta');
		}

		const cleanLabel = this.sanitizeDetectedLabel(detectedLabel);
		if (!cleanLabel) {
			throw new Error('Label hasil klasifikasi yang valid diperlukan');
		}

		this.isGenerating = true;
		try {
			const prompt = this.buildPrompt(cleanLabel, tone);
			const firstText = await this.generateWithPrompt(prompt);
			let generatedText = firstText;
			if (!generatedText || !this.containsLabel(generatedText, cleanLabel) || this.isWeakFact(generatedText, cleanLabel)) {
				const retryText = await this.generateWithPrompt(this.buildRetryPrompt(cleanLabel));
				generatedText = retryText || firstText;
			}
			if (!generatedText) {
				throw new Error('Model tidak menghasilkan teks');
			}

			const funFact = this.cleanGeneratedFact(generatedText, cleanLabel);
			if (!this.containsLabel(funFact, cleanLabel)) {
				throw new Error(`Model menghasilkan teks yang tidak relevan untuk label ${cleanLabel}`);
			}

			return {
				funFact,
				source: this.currentBackend,
				prompt,
				label: cleanLabel
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
