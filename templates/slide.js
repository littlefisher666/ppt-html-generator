/* 1600×900 浏览器预览缩放 + 统一目录/翻页导航。
   打印和 PPT 导出不得依赖预览 transform，并会隐藏导航 UI。 */
(function () {
  "use strict";

  var STAGE_WIDTH = 1600;
  var STAGE_HEIGHT = 900;

  function fit() {
    var frame = document.querySelector(".frame");
    var stage = document.querySelector(".stage");
    if (!frame || !stage) return;

    var scale = Math.max(
      0.2,
      Math.min(
        (window.innerWidth - 40) / STAGE_WIDTH,
        (window.innerHeight - 60) / STAGE_HEIGHT
      )
    );

    frame.style.width = STAGE_WIDTH * scale + "px";
    frame.style.height = STAGE_HEIGHT * scale + "px";
    stage.style.transform = "scale(" + scale + ")";
  }

  function fileName(value) {
    var clean = String(value || "").split(/[?#]/)[0];
    var parts = clean.split("/");
    return decodeURIComponent(parts[parts.length - 1] || "");
  }

  function isEditableTarget(target) {
    if (!target || target.nodeType !== 1) return false;
    var tag = target.tagName.toLowerCase();
    return (
      tag === "input" ||
      tag === "textarea" ||
      tag === "select" ||
      target.isContentEditable
    );
  }

  function deckUrl(href) {
    var deckRoot = new URL("../", window.location.href);
    return new URL(href, deckRoot).href;
  }

  function makeLink(className, label, href, disabled) {
    var link = document.createElement("a");
    link.className = className;
    link.textContent = label;

    if (disabled || !href) {
      link.setAttribute("aria-disabled", "true");
      link.tabIndex = -1;
    } else {
      link.href = href;
    }

    return link;
  }

  function buildNavigation() {
    var slideElement = document.querySelector(".slide");
    var deck = window.PPT_HTML_DECK;
    if (!slideElement || !deck || !Array.isArray(deck.slides) || !deck.slides.length) {
      return;
    }

    var currentFile = fileName(window.location.pathname);
    var currentIndex = deck.slides.findIndex(function (slide) {
      return fileName(slide.href) === currentFile;
    });

    if (currentIndex < 0) {
      var declaredPage = Number(slideElement.getAttribute("data-page"));
      currentIndex = Number.isInteger(declaredPage) ? declaredPage - 1 : -1;
    }

    if (currentIndex < 0 || currentIndex >= deck.slides.length) return;

    var previous = deck.slides[currentIndex - 1];
    var next = deck.slides[currentIndex + 1];
    var digits = Math.max(2, String(deck.slides.length).length);
    var nav = document.createElement("nav");
    var current = document.createElement("span");

    nav.className = "slide-nav";
    nav.setAttribute("aria-label", "幻灯片导航");
    nav.setAttribute("data-ppt-ui", "navigation");

    current.className = "slide-nav__current";
    current.setAttribute("aria-live", "polite");
    current.textContent =
      String(currentIndex + 1).padStart(digits, "0") +
      " / " +
      String(deck.slides.length).padStart(digits, "0");

    nav.appendChild(makeLink("slide-nav__link", "首页", deckUrl("index.html"), false));
    nav.appendChild(
      makeLink(
        "slide-nav__link",
        "上一页",
        previous ? deckUrl(previous.href) : "",
        !previous
      )
    );
    nav.appendChild(current);
    nav.appendChild(
      makeLink("slide-nav__link", "下一页", next ? deckUrl(next.href) : "", !next)
    );
    slideElement.appendChild(nav);

    window.addEventListener("keydown", function (event) {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      var targetUrl = "";
      if ((event.key === "ArrowLeft" || event.key === "ArrowUp") && previous) {
        targetUrl = deckUrl(previous.href);
      } else if ((event.key === "ArrowRight" || event.key === "ArrowDown") && next) {
        targetUrl = deckUrl(next.href);
      }

      if (targetUrl) {
        event.preventDefault();
        window.location.assign(targetUrl);
      }
    });
  }

  window.addEventListener("resize", fit);
  fit();
  buildNavigation();
})();

