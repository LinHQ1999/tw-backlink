/*\
* Reference of standard's link widget
\*/
(function () {

    /*jslint node: true, browser: true */
    /*global $tw: false */
    "use strict"

    let Widget = require("$:/core/modules/widgets/widget.js").widget
    let { extractTerms } = require("$:/plugins/LinHQ/backlink/lib/tokenize.js")
    let ctxWidget = function (parseTreeNode, options) {
        this.initialise(parseTreeNode, options)
    }

    ctxWidget.prototype = new Widget()

    ctxWidget.prototype.render = function (parent, nextSibling) {
        this.parentDomNode = parent
        this.computeAttributes()
        this.execute()

        let terms = this.getTerms()
        if (terms.length === 0) return

        if (this.wiki.isBinaryTiddler(this.tiddler)) {
            this.domNode = this.document.createElement(this.element)
            this.domNode.className = "tw-context"
            this.domNode.append("这是一个二进制 Tiddler")
            parent.insertBefore(this.domNode, nextSibling)
            this.domNodes.push(this.domNode)
            this.renderChildren(this.domNode, null)
            return
        }

        let text = this.wiki.getTiddlerText(this.tiddler)
        let ranges = this.findMatchRanges(text, terms)

        if (ranges.length > 0) {
            this.domNode = this.document.createElement(this.element)
            this.domNode.className = "tw-context"
            this.renderRanges(text, ranges, terms)
            parent.insertBefore(this.domNode, nextSibling)
            this.renderChildren(this.domNode, null)
            this.domNodes.push(this.domNode)
        }
    }

    ctxWidget.prototype.execute = function () {
        this.matchedClass = this.getAttribute("matchClass", "matched")
        this.minTermLength = this.getAttribute("min-term-length", 1)
        this.tiddler = this.getAttribute("tiddler", this.getVariable("currentTiddler"))
        this.term = this.getAttribute("term", this.getAttribute("searchTerm"))
        this.before = this.getAttribute("before", this.getAttribute("length", 25))
        this.after = this.getAttribute("after", this.getAttribute("length", 25))
        this.maxMatches = this.getAttribute("maxMatches", 5)
        this.element = this.getAttribute("element", "pre")
        const segAttr = String(this.getAttribute("seg", "no")).toLowerCase()
        this.segmentTerms = segAttr === "yes" || segAttr === "true"
        this.makeChildWidgets()
    }

    // 获取有效的关键词列表
    ctxWidget.prototype.getTerms = function () {
        if (!this.term) return []
        return extractTerms(this.term, parseInt(this.minTermLength), this.segmentTerms)
    }

    // 找到所有匹配位置并合并为区间
    ctxWidget.prototype.findMatchRanges = function (text, terms) {
        if (!text) return []
        let positions = []

        // 找所有关键词位置
        terms.forEach(term => {
            let regex = new RegExp($tw.utils.escapeRegExp(term), 'gi')
            let match
            while ((match = regex.exec(text)) !== null) {
                positions.push({ start: match.index, end: match.index + match[0].length })
            }
        })

        if (positions.length === 0) return []

        // 按位置排序
        positions.sort((a, b) => a.start - b.start)

        // 合并相近的区间
        let ranges = []
        let current = null
        let gap = this.before + this.after

        for (let pos of positions) {
            if (!current) {
                current = { start: pos.start, end: pos.end }
            } else if (pos.start - current.end < gap) {
                current.end = Math.max(current.end, pos.end)
            } else {
                ranges.push(current)
                current = { start: pos.start, end: pos.end }
            }
        }
        if (current) ranges.push(current)

        // 限制数量并扩展上下文
        return ranges.slice(0, this.maxMatches).map(r => ({
            start: Math.max(0, r.start - this.before),
            end: Math.min(text.length, r.end + this.after)
        }))
    }

    // 渲染预览区间
    ctxWidget.prototype.renderRanges = function (text, ranges, terms) {
        let node = this.domNode

        let createTextNode = (str) => this.document.createTextNode(str)
        let createMatchNode = (str) => {
            let span = this.document.createElement("span")
            span.className = this.matchedClass
            span.appendChild(createTextNode(str))
            return span
        }

        let dots = " ... \n"

        for (let i = 0; i < ranges.length; i++) {
            let range = ranges[i]
            if (i > 0 || range.start > 0) node.appendChild(createTextNode(dots))

            // 提取区间文本并高亮关键词
            let snippet = text.slice(range.start, range.end)
            let regex = new RegExp(terms.map(t => $tw.utils.escapeRegExp(t)).join('|'), 'gi')

            let lastIndex = 0
            snippet.replace(regex, (match, offset) => {
                // 添加普通文本
                if (offset > lastIndex) {
                    node.appendChild(createTextNode(snippet.slice(lastIndex, offset)))
                }
                // 添加高亮文本
                node.appendChild(createMatchNode(match))
                lastIndex = offset + match.length
                return match
            })
            // 添加剩余文本
            if (lastIndex < snippet.length) {
                node.appendChild(createTextNode(snippet.slice(lastIndex)))
            }

            if (range.end < text.length) node.appendChild(createTextNode(dots))
        }
    }

    ctxWidget.prototype.refresh = function (changedTiddlers) {
        let changedAttributes = this.computeAttributes()
        if (changedAttributes.tiddler || changedAttributes.term || changedAttributes.length || changedAttributes.matchedClass || changedAttributes.seg || changedAttributes["min-term-length"]) {
            this.refreshSelf()
            return true
        }
        return this.refreshChildren(changedTiddlers)
    }

    exports.ctx = ctxWidget

})()
