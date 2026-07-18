(function () {
  const toggle = document.querySelector(".menu-toggle");
  const navigation = document.querySelector(".navlinks");

  if (toggle && navigation) {
    toggle.addEventListener("click", function () {
      navigation.classList.toggle("open");
    });
  }
})();

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, function (character) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[character];
  });
}

function normalizeType(type) {
  const value = String(type || "").toLowerCase();

  if (value === "gedanken") {
    return "gedanke";
  }

  return value;
}

function getContentItems(type) {
  const normalizedType = normalizeType(type);
  const content = window.IDK_CONTENT || {};
  const items = Array.isArray(content.items) ? content.items : [];

  return items
    .filter(function (item) {
      return normalizeType(item.type) === normalizedType;
    })
    .map(function (item) {
      return {
        id: String(item.id || ""),
        type: normalizeType(item.type),
        title: item.title || "Ohne Titel",
        subtitle: item.subtitle || "",
        excerpt: item.excerpt || "",
        quote: item.quote || "",
        body: item.body || "",
        closingQuestion: item.closingQuestion || "",
        category:
          item.category ||
          (normalizedType === "gedanke" ? "Gedanke" : "News"),
        tags: Array.isArray(item.tags) ? item.tags : [],
        imageUrl: item.imageUrl || "",
        imagePath: item.imagePath || "",
        location: item.location || "",
        link: item.link || "",
        publishAt: item.publishAt || null,
        createdAt: item.createdAt || null,
        updatedAt: item.updatedAt || null,
        date:
          item.publishAt ||
          item.createdAt ||
          item.updatedAt ||
          null
      };
    })
    .sort(function (a, b) {
      return getTimestamp(b.date) - getTimestamp(a.date);
    });
}

function getTimestamp(value) {
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatDate(value) {
  if (!value) {
    return "Ohne Datum";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Ohne Datum";
  }

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

function getYear(value) {
  if (!value) {
    return "Ohne Datum";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Ohne Datum";
  }

  return String(date.getFullYear());
}

function createExcerpt(body) {
  const text = String(body || "")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= 180) {
    return text;
  }

  return text.slice(0, 177).trim() + " …";
}

function renderArchive(type) {
  const normalizedType = normalizeType(type);
  const items = getContentItems(normalizedType);

  const search = document.getElementById("search");
  const year = document.getElementById("year");
  const category = document.getElementById("category");
  const archive = document.getElementById("archive");
  const empty = document.getElementById("empty");

  if (!search || !year || !category || !archive || !empty) {
    return;
  }

  const years = [
    ...new Set(
      items
        .map(function (item) {
          return getYear(item.date);
        })
        .filter(function (value) {
          return value !== "Ohne Datum";
        })
    )
  ].sort().reverse();

  years.forEach(function (value) {
    year.insertAdjacentHTML(
      "beforeend",
      '<option value="' +
        escapeHtml(value) +
        '">' +
        escapeHtml(value) +
        "</option>"
    );
  });

  const categories = [
    ...new Set(
      items
        .map(function (item) {
          return item.category;
        })
        .filter(Boolean)
    )
  ].sort();

  categories.forEach(function (value) {
    category.insertAdjacentHTML(
      "beforeend",
      '<option value="' +
        escapeHtml(value) +
        '">' +
        escapeHtml(value) +
        "</option>"
    );
  });

  function draw() {
    const query = search.value.trim().toLowerCase();
    const selectedYear = year.value;
    const selectedCategory = category.value;

    const filteredItems = items.filter(function (item) {
      const searchableText = [
        item.title,
        item.subtitle,
        item.excerpt,
        item.body,
        item.quote,
        item.category,
        item.tags.join(" ")
      ]
        .join(" ")
        .toLowerCase();

      const matchesQuery =
        query === "" || searchableText.includes(query);

      const matchesYear =
        selectedYear === "all" ||
        getYear(item.date) === selectedYear;

      const matchesCategory =
        selectedCategory === "all" ||
        item.category === selectedCategory;

      return matchesQuery && matchesYear && matchesCategory;
    });

    const groups = {};

    filteredItems.forEach(function (item) {
      const itemYear = getYear(item.date);

      if (!groups[itemYear]) {
        groups[itemYear] = [];
      }

      groups[itemYear].push(item);
    });

    archive.innerHTML = "";

    Object.keys(groups)
      .sort()
      .reverse()
      .forEach(function (groupYear) {
        const cards = groups[groupYear]
          .map(function (item) {
            return createCard(item, normalizedType);
          })
          .join("");

        archive.insertAdjacentHTML(
          "beforeend",
          '<h2 class="archive-title">' +
            escapeHtml(groupYear) +
            '</h2><div class="grid">' +
            cards +
            "</div>"
        );
      });

    empty.style.display = filteredItems.length ? "none" : "block";
  }

  search.addEventListener("input", draw);
  year.addEventListener("change", draw);
  category.addEventListener("change", draw);

  draw();
}

function createCard(item, type) {
  const detailPage =
    type === "gedanke" ? "gedanke.html" : "news-detail.html";

  const url =
    detailPage + "?id=" + encodeURIComponent(item.id);

  const imageHtml = item.imageUrl
    ? '<a class="card-image" href="' +
      url +
      '">' +
      '<img src="' +
      escapeHtml(item.imageUrl) +
      '" alt="' +
      escapeHtml(item.title) +
      '" loading="lazy">' +
      "</a>"
    : "";

  const teaser =
    item.excerpt ||
    item.subtitle ||
    createExcerpt(item.body);

  return (
    '<article class="card">' +
      imageHtml +
      '<div class="card-body">' +
        '<div class="meta">' +
          "<span>" +
            escapeHtml(formatDate(item.date)) +
          "</span>" +
          '<span class="tag">' +
            escapeHtml(item.category) +
          "</span>" +
        "</div>" +
        "<h2>" +
          '<a href="' +
            url +
            '">' +
            escapeHtml(item.title) +
          "</a>" +
        "</h2>" +
        "<p>" +
          escapeHtml(teaser) +
        "</p>" +
        '<a class="more" href="' +
          url +
          '">Weiterlesen →</a>' +
      "</div>" +
    "</article>"
  );
}

function renderDetail(type) {
  const normalizedType = normalizeType(type);
  const parameters = new URLSearchParams(window.location.search);
  const requestedId = String(parameters.get("id") || "");

  const items = getContentItems(normalizedType);

  const item = items.find(function (entry) {
    return String(entry.id) === requestedId;
  });

  const root = document.getElementById("detail");

  if (!root) {
    console.error('Element mit id="detail" wurde nicht gefunden.');
    return;
  }

  const overviewPage =
    normalizedType === "gedanke"
      ? "gedanken.html"
      : "news.html";

  if (!item) {
    console.error("Eintrag nicht gefunden.", {
      requestedId: requestedId,
      availableIds: items.map(function (entry) {
        return entry.id;
      })
    });

    root.innerHTML =
      '<section class="article-head">' +
        '<div class="container-narrow">' +
          "<h1>Eintrag nicht gefunden.</h1>" +
          '<a class="back" href="' +
            overviewPage +
            '">← Zur Übersicht</a>' +
        "</div>" +
      "</section>";

    return;
  }

  document.title =
    item.title + " | Ihsan David Khalil";

  const paragraphs = String(item.body || "")
    .split(/\n\s*\n|\n/)
    .map(function (paragraph) {
      return paragraph.trim();
    })
    .filter(Boolean)
    .map(function (paragraph) {
      return "<p>" + escapeHtml(paragraph) + "</p>";
    })
    .join("");

  const imageHtml = item.imageUrl
    ? '<figure class="hero-image">' +
        '<img src="' +
          escapeHtml(item.imageUrl) +
          '" alt="' +
          escapeHtml(item.title) +
        '">' +
      "</figure>"
    : "";

  const quoteHtml = item.quote
    ? '<blockquote class="article-quote">' +
        escapeHtml(item.quote) +
      "</blockquote>"
    : "";

  const questionHtml = item.closingQuestion
    ? '<div class="closing-question">' +
        escapeHtml(item.closingQuestion) +
      "</div>"
    : "";

  const subtitleHtml = item.subtitle
    ? '<p class="lead">' +
        escapeHtml(item.subtitle) +
      "</p>"
    : "";

  root.innerHTML =
    "<article>" +
      '<header class="article-head">' +
        '<div class="container-narrow">' +
          '<span class="eyebrow">' +
            escapeHtml(item.category) +
          "</span>" +
          '<div class="article-meta">' +
            escapeHtml(formatDate(item.date)) +
          "</div>" +
          "<h1>" +
            escapeHtml(item.title) +
          "</h1>" +
          subtitleHtml +
        "</div>" +
      "</header>" +
      imageHtml +
      '<div class="container-narrow">' +
        quoteHtml +
        '<div class="article-body">' +
          paragraphs +
        "</div>" +
        questionHtml +
        '<a class="back" href="' +
          overviewPage +
          '">← Zur Übersicht</a>' +
      "</div>" +
    "</article>";
}
