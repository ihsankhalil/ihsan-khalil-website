(function () {
  const toggle = document.querySelector(".menu-toggle");
  const navigation = document.querySelector(".navlinks");

  if (toggle && navigation) {
    toggle.addEventListener("click", function () {
      navigation.classList.toggle("open");
    });
  }
})();

function esc(value) {
  return String(value || "").replace(/[&<>"]/g, function (character) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;"
    }[character];
  });
}

function normalizeType(type) {
  if (type === "gedanken") return "gedanke";
  return type;
}

function getItems(type) {
  const normalizedType = normalizeType(type);
  const content = window.IDK_CONTENT || {};
  const items = Array.isArray(content.items) ? content.items : [];

  return items
    .filter(function (item) {
      return item.type === normalizedType;
    })
    .map(function (item) {
      const date =
        item.publishAt ||
        item.createdAt ||
        item.updatedAt ||
        new Date().toISOString();

      return {
        id: item.id,
        type: item.type,
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
        location: item.location || "",
        link: item.link || "",
        date: date
      };
    })
    .sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    });
}

function formatDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

function getYear(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return String(date.getFullYear());
}

function renderArchive(type) {
  const normalizedType = normalizeType(type);
  const allItems = getItems(normalizedType);

  const search = document.getElementById("search");
  const year = document.getElementById("year");
  const category = document.getElementById("category");
  const root = document.getElementById("archive");
  const empty = document.getElementById("empty");

  if (!search || !year || !category || !root || !empty) {
    return;
  }

  const years = [
    ...new Set(
      allItems
        .map(function (item) {
          return getYear(item.date);
        })
        .filter(Boolean)
    )
  ].sort().reverse();

  years.forEach(function (value) {
    year.insertAdjacentHTML(
      "beforeend",
      '<option value="' + esc(value) + '">' + esc(value) + "</option>"
    );
  });

  const categories = [
    ...new Set(
      allItems
        .map(function (item) {
          return item.category;
        })
        .filter(Boolean)
    )
  ].sort();

  categories.forEach(function (value) {
    category.insertAdjacentHTML(
      "beforeend",
      '<option value="' + esc(value) + '">' + esc(value) + "</option>"
    );
  });

  function draw() {
    const query = search.value.trim().toLowerCase();
    const selectedYear = year.value;
    const selectedCategory = category.value;

    const filteredItems = allItems.filter(function (item) {
      const searchableText = [
        item.title,
        item.subtitle,
        item.excerpt,
        item.category,
        item.body,
        item.tags.join(" ")
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !query || searchableText.includes(query);

      const matchesYear =
        selectedYear === "all" ||
        getYear(item.date) === selectedYear;

      const matchesCategory =
        selectedCategory === "all" ||
        item.category === selectedCategory;

      return matchesSearch && matchesYear && matchesCategory;
    });

    const groups = {};

    filteredItems.forEach(function (item) {
      const itemYear = getYear(item.date) || "Ohne Datum";

      if (!groups[itemYear]) {
        groups[itemYear] = [];
      }

      groups[itemYear].push(item);
    });

    root.innerHTML = "";

    Object.keys(groups)
      .sort()
      .reverse()
      .forEach(function (groupYear) {
        const cards = groups[groupYear]
          .map(function (item) {
            return createCard(item, normalizedType);
          })
          .join("");

        root.insertAdjacentHTML(
          "beforeend",
          '<h2 class="archive-title">' +
            esc(groupYear) +
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

  const image = item.imageUrl
    ? '<a class="card-image" href="' +
      url +
      '"><img src="' +
      esc(item.imageUrl) +
      '" alt="' +
      esc(item.title) +
      '" loading="lazy"></a>'
    : "";

  const excerpt =
    item.excerpt ||
    item.subtitle ||
    createExcerpt(item.body);

  return (
    '<article class="card">' +
      image +
      '<div class="card-body">' +
        '<div class="meta">' +
          "<span>" +
            esc(formatDate(item.date)) +
          "</span>" +
          '<span class="tag">' +
            esc(item.category) +
          "</span>" +
        "</div>" +
        "<h2><a href=\"" +
          url +
          "\">" +
          esc(item.title) +
        "</a></h2>" +
        "<p>" +
          esc(excerpt) +
        "</p>" +
        '<a class="more" href="' +
          url +
          '">Weiterlesen →</a>' +
      "</div>" +
    "</article>"
  );
}

function createExcerpt(body) {
  const plainText = String(body || "")
    .replace(/\s+/g, " ")
    .trim();

  if (plainText.length <= 180) {
    return plainText;
  }

  return plainText.slice(0, 177).trim() + " …";
}

function renderDetail(type) {
  const normalizedType = normalizeType(type);
  const id = new URLSearchParams(window.location.search).get("id");
  const item = getItems(normalizedType).find(function (entry) {
    return entry.id === id;
  });

  const root = document.getElementById("detail");

  if (!root) {
    return;
  }

  const overviewPage =
    normalizedType === "gedanke"
      ? "gedanken.html"
      : "news.html";

  if (!item) {
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
      return "<p>" + esc(paragraph) + "</p>";
    })
    .join("");

  const image = item.imageUrl
    ? '<figure class="hero-image"><img src="' +
      esc(item.imageUrl) +
      '" alt="' +
      esc(item.title) +
      '"></figure>'
    : "";

  const quote = item.quote
    ? '<blockquote class="article-quote">' +
      esc(item.quote) +
      "</blockquote>"
    : "";

  const closingQuestion = item.closingQuestion
    ? '<div class="closing-question">' +
      esc(item.closingQuestion) +
      "</div>"
    : "";

  root.innerHTML =
    "<article>" +
      '<header class="article-head">' +
        '<div class="container-narrow">' +
          '<span class="eyebrow">' +
            esc(item.category) +
          "</span>" +
          '<div class="article-meta">' +
            esc(formatDate(item.date)) +
          "</div>" +
          "<h1>" +
            esc(item.title) +
          "</h1>" +
          (item.subtitle
            ? '<p class="lead">' +
              esc(item.subtitle) +
              "</p>"
            : "") +
        "</div>" +
      "</header>" +
      image +
      '<div class="container-narrow">' +
        quote +
        '<div class="article-body">' +
          paragraphs +
        "</div>" +
        closingQuestion +
        '<a class="back" href="' +
          overviewPage +
          '">← Zur Übersicht</a>' +
      "</div>" +
    "</article>";
}
