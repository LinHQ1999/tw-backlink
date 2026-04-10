/*\
title: $:/plugins/LinHQ/backlink/lib/tokenize.js
type: application/javascript
module-type: library

基于 Intl.Segmenter 的中英文分词工具

\*/

(function () {
    "use strict";

    const segmenter = Intl?.Segmenter
        ? new Intl.Segmenter(undefined, { granularity: "word" })
        : null;

    const makeTokenize = minLen => {
        const min = Math.max(1, minLen | 0);
        const segment = text =>
            segmenter
                ? [...segmenter.segment(text)].filter(s => s.isWordLike && s.segment.length >= min)
                : text.split(/[\s\p{P}]+/u).filter(t => t.length >= min);
        // MiniSearch 调用签名: tokenize(text, fieldName)，忽略第二个参数
        return text => segment(text).map(s => s.segment.toLowerCase());
    };

    // 保留原始大小写，用于高亮匹配；useSegment 为 false 时仅按空白/标点切分（与无 Segmenter 时一致）
    const extractTerms = (text, minLen, useSegment = false) => {
        const min = Math.max(1, (minLen ?? 1) | 0);
        if (!useSegment || !segmenter) {
            return text.split(/[\s\p{P}]+/u).filter(t => t.length >= min);
        }
        return [...segmenter.segment(text)]
            .filter(s => s.isWordLike && s.segment.length >= min)
            .map(s => s.segment);
    };

    exports.makeTokenize = makeTokenize;
    exports.tokenize = makeTokenize(1);
    exports.extractTerms = extractTerms;
})();
