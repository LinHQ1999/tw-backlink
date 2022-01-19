(function () {
    "use strict";

    /*
    寻找关键字相关部分，使用了核心 API 渲染匹配结果
    */

    exports.name = "finder";

    exports.params = [
        { name: "title" },
        { name: "keyword" }
    ];

    /*
    Run the macro
    */
    exports.run = function (title, keyword) {
        let lines = $tw.wiki.getTiddlerText(title, "").split(/\n/)
        // 忽略大小写
        keyword = keyword.toLowerCase()
        for (let line of lines) {
            if (line.toLowerCase().includes(keyword)) {
                return `<$text text="""${line}"""/>`
            }
        }
        return "没有搜索结果"
    };
})();