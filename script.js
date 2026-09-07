/* =========================================================
   SmartBin Pro — animation system
   IntersectionObserver triggers + requestAnimationFrame
   Global easing: cubic-bezier(0.22, 1, 0.36, 1)
   Every animation replays on each viewport entry; observers
   keep tracking their elements forever, so scrolling up or
   down re-triggers every animation.
   ========================================================= */
(function () {
  "use strict";

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.addEventListener("load", function () {
    if (!location.hash) window.scrollTo(0, 0);
  });

  var DUR = {
    reveal: 700,
    stagger: 120,
    count: 1500,
    gallery: 900,
    step: 600
  };

  /* ---- cubic-bezier(0.22, 1, 0.36, 1) solver for rAF easing ---- */
  function cubicBezier(p1x, p1y, p2x, p2y) {
    function A(a1, a2) { return 1 - 3 * a2 + 3 * a1; }
    function B(a1, a2) { return 3 * a2 - 6 * a1; }
    function C(a1) { return 3 * a1; }
    function calc(t, a1, a2) { return ((A(a1, a2) * t + B(a1, a2)) * t + C(a1)) * t; }
    function slope(t, a1, a2) { return 3 * A(a1, a2) * t * t + 2 * B(a1, a2) * t + C(a1); }
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      var t = x;
      for (var i = 0; i < 6; i++) {
        var s = slope(t, p1x, p2x);
        if (s === 0) break;
        t -= (calc(t, p1x, p2x) - x) / s;
      }
      return calc(t, p1y, p2y);
    };
  }
  var EASE = cubicBezier(0.22, 1, 0.36, 1);

  /* ---- primitives ---- */
  function reveal(el) {
    el.style.transitionDelay = (parseInt(el.getAttribute("data-reveal-delay") || "0", 10)) + "ms";
    el.classList.add("is-revealed");
    if (el.hasAttribute("data-stat")) el.classList.add("is-in");
  }

  function unreveal(el) {
    el.style.transitionDelay = "0ms";
    el.classList.remove("is-revealed", "is-in");
  }

  function formatCount(value, format) {
    if (format === "comma") return Math.round(value).toLocaleString("en-US");
    return String(Math.round(value));
  }

  function countUp(el) {
    var to = parseFloat(el.getAttribute("data-count-to"));
    var format = el.getAttribute("data-count-format");
    if (el._raf) cancelAnimationFrame(el._raf);
    var start = null;
    function frame(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / DUR.count, 1);
      el.textContent = formatCount(to * EASE(p), format);
      el._raf = p < 1 ? requestAnimationFrame(frame) : null;
    }
    el._raf = requestAnimationFrame(frame);
  }

  function resetCount(el) {
    if (el._raf) cancelAnimationFrame(el._raf);
    el._raf = null;
    el.textContent = "0";
  }

  function drawSVG(path) {
    var len = path.getTotalLength();
    if (path._raf) cancelAnimationFrame(path._raf);
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;
    var start = null;
    function frame(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / DUR.reveal, 1);
      path.style.strokeDashoffset = len * (1 - EASE(p));
      path._raf = p < 1 ? requestAnimationFrame(frame) : null;
    }
    path._raf = requestAnimationFrame(frame);
  }

  function resetSVG(path) {
    if (path._raf) cancelAnimationFrame(path._raf);
    path._raf = null;
    path.style.strokeDasharray = "";
    path.style.strokeDashoffset = "";
  }

  /* ---- reveal observer: replays on every entry, resets on exit ---- */
  var revealIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) reveal(entry.target);
      else unreveal(entry.target);
    });
  }, { threshold: 0.18 });
  document.querySelectorAll("[data-reveal], [data-stat]").forEach(function (el) { revealIO.observe(el); });

  /* ---- metric / flip count-up: replays near viewport center ---- */
  var countIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) countUp(entry.target);
      else resetCount(entry.target);
    });
  }, { rootMargin: "-35% 0px -35% 0px", threshold: 0 });
  document.querySelectorAll("[data-count]").forEach(function (el) { countIO.observe(el); });

  /* ---- hero parallax: translateY -15% .. +15% ---- */
  var heroBg = document.querySelector("[data-parallax]");
  var hero = document.getElementById("hero");

  /* ---- gallery scroll-linked scale/rotate ---- */
  var galleryItems = Array.prototype.slice.call(document.querySelectorAll("[data-gallery-item]"));

  /* ---- exploded internals ---- */
  var exploded = document.querySelector("[data-exploded]");
  var exTimers = [];

  function runExploded() {
    if (!exploded || exploded.classList.contains("is-apart")) return;
    exploded.classList.add("is-apart");
    Array.prototype.forEach.call(exploded.querySelectorAll(".conn"), function (p, i) {
      exTimers.push(setTimeout(function () { drawSVG(p); }, i * DUR.stagger));
    });
  }

  function resetExploded() {
    if (!exploded) return;
    exTimers.forEach(clearTimeout);
    exTimers = [];
    exploded.classList.remove("is-apart");
    Array.prototype.forEach.call(exploded.querySelectorAll(".conn"), resetSVG);
  }

  if (exploded) {
    var exIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) runExploded();
        else resetExploded();
      });
    }, { threshold: 0.35 });
    exIO.observe(exploded);
  }

  /* ---- flip cards ---- */
  document.querySelectorAll(".flip").forEach(function (card) {
    function flip() { card.classList.toggle("is-flipped"); }
    card.addEventListener("click", flip);
    card.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); }
    });
  });

  /* ---- coupon scroll timeline ---- */
  var coupon = document.querySelector("[data-coupon]");
  var couponSteps = coupon ? coupon.querySelectorAll("[data-cstep]") : [];
  var couponSlip = coupon ? coupon.querySelector("[data-coupon-slip]") : null;
  var couponBar = coupon ? coupon.querySelector("[data-coupon-bar]") : null;

  function updateCoupon() {
    if (!coupon) return;
    var rect = coupon.getBoundingClientRect();
    var vh = window.innerHeight;
    var p = Math.min(Math.max((vh - rect.top) / (vh + rect.height), 0), 1);
    if (couponBar) couponBar.style.width = (p * 100).toFixed(1) + "%";
    var idx = Math.min(Math.floor(p * couponSteps.length), couponSteps.length - 1);
    if (p <= 0) idx = 0;
    Array.prototype.forEach.call(couponSteps, function (s, i) {
      s.classList.toggle("is-active", i === idx);
    });
    if (couponSlip) couponSlip.classList.toggle("is-printing", idx >= 2);
  }

  /* ---- nav active link ---- */
  var sections = ["problem", "effect", "solution", "working"];
  var navIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var id = e.target.id;
      document.querySelectorAll("[data-navlink]").forEach(function (a) {
        a.classList.toggle("is-active", a.getAttribute("data-navlink") === id);
      });
    });
  }, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });
  sections.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) navIO.observe(el);
  });

  /* ---- burger menu ---- */
  var burger = document.getElementById("navBurger");
  var mobileMenu = document.getElementById("mobileMenu");
  if (burger && mobileMenu) {
    burger.addEventListener("click", function () {
      var open = mobileMenu.hasAttribute("hidden");
      if (open) mobileMenu.removeAttribute("hidden");
      else mobileMenu.setAttribute("hidden", "");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    mobileMenu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        mobileMenu.setAttribute("hidden", "");
        burger.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---- single rAF scroll loop: parallax + gallery + coupon ---- */
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;

      if (heroBg && hero) {
        var hr = hero.getBoundingClientRect();
        var hp = Math.min(Math.max((-hr.top) / (hr.height || 1), 0), 1);
        var ty = (-15 + hp * 30); /* -15% .. +15% */
        heroBg.style.transform = "translate3d(0," + ty.toFixed(2) + "%,0)";
      }

      galleryItems.forEach(function (item, i) {
        var r = item.getBoundingClientRect();
        var vh = window.innerHeight;
        var p = Math.min(Math.max((vh - r.top) / (vh + r.height), 0), 1);
        var scale = 0.92 + 0.08 * EASE(p);
        var rot = (i % 2 === 0 ? -1 : 1) * (1 - EASE(p)) * 3;
        item.style.transform = "scale(" + scale.toFixed(3) + ") rotate(" + rot.toFixed(2) + "deg)";
      });

      updateCoupon();
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();
})();
