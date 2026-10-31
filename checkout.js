(function () {
  "use strict";

  // ===== PENGATURAN =====================================================
  // Saat go-live: ubah ENV menjadi "production" dan isi Client Key Production.
  var ENV = "production";

  // Client Key aman ditaruh di halaman web (Server Key JANGAN pernah).
  var CLIENT_KEY = {
    sandbox: "Mid-client-Lv0DN7FuQFCcSBCE",
    production: "ISI_CLIENT_KEY_PRODUCTION",
  };

  var SNAP_SRC = {
    sandbox: "https://app.sandbox.midtrans.com/snap/snap.js",
    production: "https://app.midtrans.com/snap/snap.js",
  };

  // Function URL dari Lambda versx-create-order
  var ORDER_URL =
    "https://3orlhv6gbouzixvtizqja5xykm0qsqbv.lambda-url.ap-southeast-1.on.aws/";
  // =======================================================================

  var TEXT = {
    en: {
      buy: "Purchase Now",
      name: "Full name",
      email: "Email (your e-book link will be sent here)",
      pay: "Continue to payment",
      wait: "Preparing your payment...",
      invalid: "Please enter your name and a valid email address.",
      success:
        "Payment received. Your e-book link is on its way to your email (please also check your spam folder).",
      pending: "Waiting for your payment to be completed.",
      failed: "Payment failed. Please try again.",
      closed:
        "The payment window was closed. You can try again whenever you are ready.",
      error: "Something went wrong. Please try again in a moment.",
    },
    id: {
      buy: "Beli Sekarang",
      name: "Nama lengkap",
      email: "Email (link e-book akan dikirim ke sini)",
      pay: "Lanjut ke pembayaran",
      wait: "Menyiapkan pembayaran...",
      invalid: "Mohon isi nama dan alamat email yang valid.",
      success:
        "Pembayaran diterima. Link e-book sedang dikirim ke email Anda (cek juga folder spam).",
      pending: "Menunggu pembayaran Anda diselesaikan.",
      failed: "Pembayaran gagal. Silakan coba lagi.",
      closed:
        "Jendela pembayaran ditutup. Anda bisa mencobanya lagi kapan saja.",
      error: "Terjadi kesalahan. Silakan coba lagi sebentar lagi.",
    },
  };

  var INPUT_STYLE =
    "width:100%;padding:10px;border:1px solid #ccc;border-radius:8px;" +
    "font:inherit;box-sizing:border-box;background:#fff;color:#222;";
  var LABEL_STYLE = "display:block;font-size:.9rem;margin:12px 0 4px;";

  // Memuat snap.js hanya saat dibutuhkan (pengunjung yang tidak membeli
  // tidak ikut mengunduhnya).
  var snapPromise = null;
  function loadSnap() {
    if (window.snap) return Promise.resolve();
    if (snapPromise) return snapPromise;
    snapPromise = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = SNAP_SRC[ENV];
      s.setAttribute("data-client-key", CLIENT_KEY[ENV]);
      s.onload = resolve;
      s.onerror = function () {
        snapPromise = null;
        reject(new Error("snap-load"));
      };
      document.head.appendChild(s);
    });
    return snapPromise;
  }

  function mount(el) {
    var bookId = el.getAttribute("data-book-id");
    var t = TEXT[el.getAttribute("data-lang")] || TEXT.en;
    if (!bookId) return;

    el.innerHTML =
      '<a href="#" class="btn-buy" data-role="open">' + t.buy + "</a>" +
      '<form data-role="form" style="display:none;margin-top:16px;text-align:left" novalidate>' +
      '<label style="' + LABEL_STYLE + '">' + t.name + "</label>" +
      '<input data-role="name" type="text" maxlength="60" autocomplete="name" style="' + INPUT_STYLE + '">' +
      '<label style="' + LABEL_STYLE + '">' + t.email + "</label>" +
      '<input data-role="email" type="email" maxlength="120" autocomplete="email" style="' + INPUT_STYLE + '">' +
      '<a href="#" class="btn-buy" data-role="pay" style="margin-top:16px">' + t.pay + "</a>" +
      '<div data-role="msg" role="status" style="margin-top:12px;font-size:.92rem;min-height:1.2em"></div>' +
      "</form>";

    function q(role) {
      return el.querySelector('[data-role="' + role + '"]');
    }
    var openBtn = q("open"), form = q("form"), payBtn = q("pay");
    var nameInput = q("name"), emailInput = q("email"), msg = q("msg");
    var busy = false;

    function say(text) {
      msg.textContent = text;
    }

    openBtn.addEventListener("click", function (e) {
      e.preventDefault();
      form.style.display = "block";
      openBtn.style.display = "none";
      nameInput.focus();
    });

    function start(e) {
      if (e) e.preventDefault();
      if (busy) return;

      var name = nameInput.value.trim();
      var email = emailInput.value.trim();
      if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        say(t.invalid);
        return;
      }

      busy = true;
      payBtn.style.opacity = ".6";
      say(t.wait);

      fetch(ORDER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: bookId, name: name, email: email }),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (r) {
          if (!r.ok || !r.data || !r.data.token) throw new Error("order");
          return loadSnap().then(function () {
            return r.data.token;
          });
        })
        .then(function (token) {
          say("");
          window.snap.pay(token, {
            onSuccess: function () {
              form.style.display = "none";
              openBtn.style.display = "none";
              // pesan sukses ditaruh di luar form yang disembunyikan
              var done = document.createElement("div");
              done.setAttribute("role", "status");
              done.style.cssText = "margin-top:16px;font-size:.95rem;";
              done.textContent = t.success;
              el.appendChild(done);
            },
            onPending: function () { say(t.pending); },
            onError: function () { say(t.failed); },
            onClose: function () { say(t.closed); },
          });
        })
        .catch(function () {
          say(t.error);
        })
        .then(function () {
          busy = false;
          payBtn.style.opacity = "";
        });
    }

    payBtn.addEventListener("click", start);
    form.addEventListener("submit", start);
    [nameInput, emailInput].forEach(function (input) {
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") start(e);
      });
    });
  }

  function init() {
    var els = document.querySelectorAll("[data-checkout]");
    for (var i = 0; i < els.length; i++) mount(els[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
