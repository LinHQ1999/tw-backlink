/*\
title: $:/plugins/LinHQ/backlink/search-indexer.js
type: application/javascript
module-type: indexer

全文搜索引擎索引器，使用 MiniSearch 实现高性能搜索

\*/

(function () {
    "use strict";

    const MiniSearch = require("$:/plugins/LinHQ/backlink/lib/minisearch.min.js");
    const { makeTokenize } = require("$:/plugins/LinHQ/backlink/lib/tokenize.js");
    const CONFIG_TITLE = "$:/config/plugins/LinHQ/backlink/search-indexer";

    /** 与 TiddlyWiki 常见结构一致：标题 / 展示用 caption / 结构化 tags / 正文 text */
    const TW_FIELD_BOOST = { title: 4, caption: 2.5, tags: 2, text: 1 };

    /** 多词默认 OR；需要 AND 时在 `fts`/`fulltext` 后缀中加 `and`，或直接传入 `searchFullText(..., { combineWith: 'AND' })` */
    const DEFAULT_COMBINE_WITH = "OR";

    /** MiniSearch storeFields：随命中保留轻量字段；当前 API 不向外返回这些值，故不设用户配置 */
    const STORED_RESULT_FIELDS = "title tags caption";

    const DEFAULTS = {
        fields: "title text tags caption",
        fuzzy: 0,
        prefix: true,
        excludeSystem: true,
        excludeBinary: true,
        minTokenLength: 1
    };

    const boostForFields = fieldNames => {
        const boost = {};
        for (const f of fieldNames) {
            if (Object.prototype.hasOwnProperty.call(TW_FIELD_BOOST, f)) boost[f] = TW_FIELD_BOOST[f];
        }
        return boost;
    };

    const splitSpaceList = s => String(s).trim().split(/\s+/).filter(Boolean);

    const toDoc = (title, tiddler) => ({
        id: title,
        title,
        text: tiddler.fields.text || "",
        tags: (tiddler.fields.tags ?? []).join(" "),
        caption: tiddler.fields.caption || ""
    });

    class SearchIndexer {
        constructor(wiki) {
            this.wiki = wiki;
        }

        init() {
            this.miniSearch = null;
            this.config = this.#loadConfig();
            this.wiki.searchFullText = (query, options) => this.search(query, options);
        }

        #loadConfig() {
            const o = $tw.utils.extend({}, DEFAULTS, this.wiki.getTiddlerData(CONFIG_TITLE, {}));
            const str = k => typeof o[k] === "string" && o[k].trim() ? o[k] : DEFAULTS[k];
            const bool = k =>
                o[k] === true || o[k] === "true" ? true : o[k] === false || o[k] === "false" ? false : DEFAULTS[k];
            const fz = typeof o.fuzzy === "number" ? o.fuzzy : parseFloat(o.fuzzy);
            const mt = parseInt(o.minTokenLength, 10);
            return {
                fields: str("fields"),
                fuzzy: Number.isFinite(fz) ? fz : DEFAULTS.fuzzy,
                prefix: bool("prefix"),
                excludeSystem: bool("excludeSystem"),
                excludeBinary: bool("excludeBinary"),
                minTokenLength: Number.isFinite(mt) && mt >= 1 ? mt : DEFAULTS.minTokenLength
            };
        }

        clear() {
            this.miniSearch = null;
        }

        rebuild() {
            this.clear();
        }

        #shouldIndex(title, tiddler) {
            return !(
                (this.config.excludeSystem && title.startsWith("$:/")) ||
                (this.config.excludeBinary && this.wiki.isBinaryTiddler(tiddler))
            );
        }

        #upsert(title, tiddler) {
            if (!this.#shouldIndex(title, tiddler)) {
                this.miniSearch.has(title) && this.miniSearch.discard(title);
                return;
            }
            const doc = toDoc(title, tiddler);
            this.miniSearch.has(title) ? this.miniSearch.replace(doc) : this.miniSearch.add(doc);
        }

        update({ old: oldDesc, new: newDesc }) {
            if (!this.miniSearch) return;

            if (oldDesc.exists && !newDesc.exists) {
                this.miniSearch.has(oldDesc.tiddler.fields.title) && this.miniSearch.discard(oldDesc.tiddler.fields.title);
                return;
            }

            newDesc.exists && this.#upsert(newDesc.tiddler.fields.title, newDesc.tiddler);
        }

        _initMiniSearch() {
            const { fields, minTokenLength } = this.config;
            this.miniSearch = new MiniSearch({
                fields: splitSpaceList(fields),
                storeFields: splitSpaceList(STORED_RESULT_FIELDS),
                tokenize: makeTokenize(minTokenLength),
                processTerm: term => term.toLowerCase()
            });

            this.wiki.eachTiddlerPlusShadows((tiddler, title) => {
                if (!this.#shouldIndex(title, tiddler)) return;
                try {
                    this.miniSearch.add(toDoc(title, tiddler));
                } catch (e) {
                    if (e.message?.includes("duplicate")) return;
                    console.debug("Index error for", title, ":", e.message);
                }
            });
        }

        search(query, options = {}) {
            if (!this.miniSearch) this._initMiniSearch();
            if (!query?.trim()) return [];

            try {
                const { fuzzy, prefix, fields } = this.config;
                const fieldNames = splitSpaceList(fields);
                const boost = boostForFields(fieldNames);
                return this.miniSearch.search(query, {
                    fuzzy,
                    prefix,
                    combineWith: DEFAULT_COMBINE_WITH,
                    boost,
                    ...options
                })
                    .map(({ id, score, match, terms }) => ({ title: id, score, match, terms }));
            } catch (e) {
                console.error("SearchIndexer error:", e);
                return [];
            }
        }

        getStats() {
            const { documentCount = 0, termCount = 0 } = this.miniSearch ?? {};
            return { documentCount, termCount, indexed: !!this.miniSearch };
        }
    }

    exports.SearchIndexer = SearchIndexer;
})();
