/**
 * 语音交互引擎 - 支持语音识别和语音合成
 * 
 * 功能：
 * 1. 语音识别（STT）- 将用户语音转换为文本
 * 2. 语音合成（TTS）- 将文本转换为语音播放
 * 3. 语音指令解析 - 解析用户语音指令
 * 4. 上下文对话管理 - 维护对话上下文
 */

class VoiceInteractionEngine {
  constructor() {
    this.recognition = null;
    this.synthesis = window.speechSynthesis;
    this.isListening = false;
    this.conversationHistory = [];
    this.currentContext = null;
    
    // 支持的语言
    this.supportedLanguages = {
      'zh-CN': '中文（简体）',
      'zh-TW': '中文（繁体）',
      'en-US': '英语（美国）',
      'ja-JP': '日语',
      'ko-KR': '韩语'
    };
    
    // 当前语言
    this.currentLanguage = 'zh-CN';
    
    // 语音识别配置
    this.recognitionConfig = {
      continuous: false,
      interimResults: true,
      maxAlternatives: 1,
      lang: 'zh-CN'
    };
    
    // 语音合成配置
    this.synthesisConfig = {
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
      lang: 'zh-CN'
    };
    
    // 初始化语音识别
    this.initializeRecognition();
  }

  /**
   * 初始化语音识别
   */
  initializeRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error('浏览器不支持语音识别');
      return false;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    
    // 配置语音识别
    this.recognition.continuous = this.recognitionConfig.continuous;
    this.recognition.interimResults = this.recognitionConfig.interimResults;
    this.recognition.maxAlternatives = this.recognitionConfig.maxAlternatives;
    this.recognition.lang = this.recognitionConfig.lang;
    
    // 设置事件监听
    this.recognition.onstart = () => {
      this.isListening = true;
      console.log('语音识别已启动');
    };
    
    this.recognition.onend = () => {
      this.isListening = false;
      console.log('语音识别已结束');
    };
    
    this.recognition.onresult = (event) => {
      const result = this.processRecognitionResult(event);
      if (result.final) {
        this.handleUserInput(result.transcript);
      }
    };
    
    this.recognition.onerror = (event) => {
      console.error('语音识别错误:', event.error);
      this.isListening = false;
    };
    
    return true;
  }

  /**
   * 处理语音识别结果
   */
  processRecognitionResult(event) {
    let transcript = '';
    let isFinal = false;
    
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      transcript += result[0].transcript;
      
      if (result.isFinal) {
        isFinal = true;
      }
    }
    
    return {
      transcript: transcript.trim(),
      final: isFinal,
      confidence: event.results[event.results.length - 1][0].confidence
    };
  }

  /**
   * 启动语音识别
   */
  startListening() {
    if (!this.recognition) {
      console.error('语音识别未初始化');
      return false;
    }
    
    if (this.isListening) {
      console.log('语音识别已在运行');
      return true;
    }
    
    try {
      this.recognition.start();
      return true;
    } catch (error) {
      console.error('启动语音识别失败:', error);
      return false;
    }
  }

  /**
   * 停止语音识别
   */
  stopListening() {
    if (!this.recognition || !this.isListening) {
      return false;
    }
    
    try {
      this.recognition.stop();
      return true;
    } catch (error) {
      console.error('停止语音识别失败:', error);
      return false;
    }
  }

  /**
   * 语音合成（TTS）
   */
  speak(text, options = {}) {
    if (!this.synthesis) {
      console.error('浏览器不支持语音合成');
      return false;
    }
    
    // 取消当前正在播放的语音
    this.synthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // 配置语音合成参数
    utterance.rate = options.rate || this.synthesisConfig.rate;
    utterance.pitch = options.pitch || this.synthesisConfig.pitch;
    utterance.volume = options.volume || this.synthesisConfig.volume;
    utterance.lang = options.lang || this.synthesisConfig.lang;
    
    // 选择语音
    if (options.voice) {
      utterance.voice = options.voice;
    }
    
    // 事件监听
    utterance.onstart = () => {
      console.log('开始播放语音:', text);
    };
    
    utterance.onend = () => {
      console.log('语音播放完成');
    };
    
    utterance.onerror = (event) => {
      console.error('语音合成错误:', event.error);
    };
    
    this.synthesis.speak(utterance);
    return true;
  }

  /**
   * 停止语音播放
   */
  stopSpeaking() {
    if (!this.synthesis) {
      return false;
    }
    
    this.synthesis.cancel();
    return true;
  }

  /**
   * 处理用户输入
   */
  async handleUserInput(transcript) {
    console.log('用户输入:', transcript);
    
    // 添加到对话历史
    this.conversationHistory.push({
      role: 'user',
      content: transcript,
      timestamp: new Date().toISOString()
    });
    
    // 解析语音指令
    const intent = this.parseIntent(transcript);
    
    // 根据意图执行相应操作
    const response = await this.executeIntent(intent, transcript);
    
    // 添加响应到对话历史
    this.conversationHistory.push({
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString()
    });
    
    // 语音播放响应
    this.speak(response);
    
    return response;
  }

  /**
   * 解析语音指令意图
   */
  parseIntent(transcript) {
    const text = transcript.toLowerCase();
    
    // 痛点诊断相关指令
    if (text.includes('痛点') || text.includes('问题') || text.includes('不舒服')) {
      return {
        type: 'pain_point_diagnosis',
        confidence: 0.9
      };
    }
    
    // 方案相关指令
    if (text.includes('方案') || text.includes('推荐') || text.includes('建议')) {
      return {
        type: 'solution_recommendation',
        confidence: 0.9
      };
    }
    
    // 报价相关指令
    if (text.includes('价格') || text.includes('报价') || text.includes('多少钱')) {
      return {
        type: 'quotation',
        confidence: 0.9
      };
    }
    
    // 户型相关指令
    if (text.includes('户型') || text.includes('面积') || text.includes('房间')) {
      return {
        type: 'room_profile',
        confidence: 0.8
      };
    }
    
    // 帮助相关指令
    if (text.includes('帮助') || text.includes('怎么') || text.includes('如何')) {
      return {
        type: 'help',
        confidence: 0.9
      };
    }
    
    // 默认意图
    return {
      type: 'general_query',
      confidence: 0.5
    };
  }

  /**
   * 执行意图
   */
  async executeIntent(intent, transcript) {
    switch (intent.type) {
      case 'pain_point_diagnosis':
        return await this.handlePainPointDiagnosis(transcript);
      
      case 'solution_recommendation':
        return await this.handleSolutionRecommendation(transcript);
      
      case 'quotation':
        return await this.handleQuotation(transcript);
      
      case 'room_profile':
        return await this.handleRoomProfile(transcript);
      
      case 'help':
        return this.getHelpMessage();
      
      case 'general_query':
        return await this.handleGeneralQuery(transcript);
      
      default:
        return '抱歉，我没有理解您的意思。请问您需要什么帮助？';
    }
  }

  /**
   * 处理痛点诊断
   */
  async handlePainPointDiagnosis(transcript) {
    // 提取痛点信息
    const painPoints = this.extractPainPoints(transcript);
    
    if (painPoints.length > 0) {
      return `我了解到您遇到了${painPoints.join('、')}等问题。我会为您进行详细的痛点诊断分析。`;
    } else {
      return '请问您具体遇到了什么问题？比如：楼层温差大、热水等待时间长、室内空气差等。';
    }
  }

  /**
   * 处理方案推荐
   */
  async handleSolutionRecommendation(transcript) {
    return '根据您的需求，我为您推荐以下系统方案：中央空调系统、新风系统、热水系统。您想了解哪个系统的详细信息？';
  }

  /**
   * 处理报价
   */
  async handleQuotation(transcript) {
    return '根据您的户型和需求，初步报价约为5-8万元。具体价格需要根据您选择的设备型号和配置来确定。';
  }

  /**
   * 处理户型信息
   */
  async handleRoomProfile(transcript) {
    return '请问您的房屋面积是多少？房屋类型是公寓、别墅还是其他？';
  }

  /**
   * 获取帮助信息
   */
  getHelpMessage() {
    return `我可以帮助您：
    1. 痛点诊断 - 告诉我您遇到的问题
    2. 方案推荐 - 为您推荐合适的系统方案
    3. 报价咨询 - 了解初步报价信息
    4. 户型分析 - 分析您的户型特点
    
    请告诉我您需要什么帮助？`;
  }

  /**
   * 处理通用查询
   */
  async handleGeneralQuery(transcript) {
    // 简单的关键词匹配回复
    if (transcript.includes('你好') || transcript.includes('您好')) {
      return '您好！我是瑞美舒适家居系统的智能助手。请问有什么可以帮您的？';
    }
    
    if (transcript.includes('谢谢') || transcript.includes('感谢')) {
      return '不客气！很高兴为您服务。';
    }
    
    if (transcript.includes('再见') || transcript.includes('拜拜')) {
      return '再见！祝您生活愉快！';
    }
    
    return '抱歉，我没有完全理解您的意思。您可以询问关于痛点诊断、方案推荐、报价或户型分析的问题。';
  }

  /**
   * 提取痛点信息
   */
  extractPainPoints(transcript) {
    const painPointKeywords = [
      '温差大', '冷热不均', '热水慢', '等待久',
      '空气差', '有异味', '潮湿', '干燥',
      '噪音大', '水压小', '水温不稳'
    ];
    
    const foundPainPoints = painPointKeywords.filter(keyword => 
      transcript.includes(keyword)
    );
    
    return foundPainPoints;
  }

  /**
   * 获取可用的语音列表
   */
  getAvailableVoices() {
    if (!this.synthesis) {
      return [];
    }
    
    return this.synthesis.getVoices();
  }

  /**
   * 设置语言
   */
  setLanguage(lang) {
    if (!this.supportedLanguages[lang]) {
      console.error('不支持的语言:', lang);
      return false;
    }
    
    this.currentLanguage = lang;
    this.recognitionConfig.lang = lang;
    this.synthesisConfig.lang = lang;
    
    if (this.recognition) {
      this.recognition.lang = lang;
    }
    
    return true;
  }

  /**
   * 获取对话历史
   */
  getConversationHistory() {
    return this.conversationHistory;
  }

  /**
   * 清空对话历史
   */
  clearConversationHistory() {
    this.conversationHistory = [];
    this.currentContext = null;
  }

  /**
   * 获取当前状态
   */
  getStatus() {
    return {
      isListening: this.isListening,
      isSupported: {
        recognition: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
        synthesis: !!window.speechSynthesis
      },
      currentLanguage: this.currentLanguage,
      conversationLength: this.conversationHistory.length
    };
  }
}

// 导出单例实例
const voiceInteractionEngine = new VoiceInteractionEngine();

module.exports = voiceInteractionEngine;
