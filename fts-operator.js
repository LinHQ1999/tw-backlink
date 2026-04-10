/*\
title: $:/plugins/LinHQ/backlink/fts-operator.js
type: application/javascript
module-type: filteroperator

全文搜索 filter operator，使用 SearchIndexer。后缀分段与 core `search` 一致：`:` 分隔段，`,` 分隔段内 token。

- 第一段仅字段名（及 `-` / `*` 约定），`or` / `and` / `casesensitive` / `exact` 等标志须写在第二段，且拼写与大小写须与下列一致。
- 多字段：`[fts:title,text[query]]`
- 字段 + flag：`[fts:title,text:casesensitive[query]]`
- 仅 flag：`[fts::casesensitive[query]]`（首段为空）
- 第二段可写 `or` / `and` 指定当次检索的多词组合（相对默认 OR）
- 排除字段：`[fts:-text[query]]`；不限字段：`[fts:*[query]]` 或 `[fts[query]]`
- 模糊匹配强度由 [[$:/config/plugins/LinHQ/backlink/search-indexer]] 的 `fuzzy` 控制

\*/

(function () {
    "use strict";

    const FLAGS = new Set(["or", "and", "casesensitive", "exact"]);

    exports.fulltext = exports.fts = function (_source, operator, options) {
        const query = operator.operand || "";

        if (!query || query.trim() === "") {
            return [];
        }

        const searchIndexer = options.wiki.getIndexer("SearchIndexer");

        if (!searchIndexer) {
            console.warn("SearchIndexer not available");
            return [];
        }

        const searchOptions = {};
        const indexedFields = String(searchIndexer.config?.fields ?? "")
            .trim()
            .split(/\s+/)
            .filter(Boolean);

        if (operator.suffixes) {
            const fieldCandidates = operator.suffixes[0] || [];
            const raw1 = operator.suffixes[1] || [];

            if (fieldCandidates.length > 0) {
                const first = fieldCandidates[0] || "";
                if (first.startsWith("-")) {
                    const excluded = [first.slice(1), ...fieldCandidates.slice(1)].filter(Boolean);
                    searchOptions.fields = indexedFields.filter(f => !excluded.includes(f));
                } else if (first !== "*") {
                    searchOptions.fields = fieldCandidates;
                }
            }

            let wantOr;
            let wantAnd;
            for (const e of raw1) {
                if (!FLAGS.has(e)) continue;
                if (e === "or") wantOr = true;
                else if (e === "and") wantAnd = true;
                else if (e === "casesensitive") {
                    searchOptions.processTerm = term => term;
                } else if (e === "exact") {
                    searchOptions.fuzzy = false;
                    searchOptions.prefix = false;
                }
            }
            if (wantAnd) searchOptions.combineWith = "AND";
            else if (wantOr) searchOptions.combineWith = "OR";
        }

        const results = searchIndexer.search(query, searchOptions);
        const titles = results.map(r => r.title);

        if (operator.prefix === "!") {
            const hit = new Set(titles);
            return options.wiki.allTitles().filter(t => !hit.has(t));
        }

        return titles;
    };
})();
