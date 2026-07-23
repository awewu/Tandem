const QuotationEngineV2 = require('./QuotationEngine-v2');
// exported as QuotationEngine class
const engine = new QuotationEngineV2();
function generateQuotation(params) { return engine.generateQuotation ? engine.generateQuotation(params) : engine.generate ? engine.generate(params) : null; }
module.exports = { generateQuotation, QuotationEngineV2 };
