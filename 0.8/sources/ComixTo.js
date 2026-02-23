import {
  Source,
  Manga,
  Chapter,
  Page
} from "paperback-extensions-common"

const BASE_URL = "https://comix.to"

export const ComixTo = new Source({
  name: "Comix.to",
  baseUrl: BASE_URL,
  version: "1.0.0",
  requestManager: {
    requestsPerSecond: 3,
    requestTimeout: 10000
  },

  // Search
  async searchRequest(query, metadata) {
    const url = `${BASE_URL}/search?q=${encodeURIComponent(query.title)}`
    return this.requestManager.schedule(url, { method: "GET" })
  },

  async searchParse(response) {
    const $ = this.cheerio.load(response.data)
    const results = []
    $("a[href^='/title/']").each((_, el) => {
      const href = $(el).attr("href")
      const title = $(el).find("img").attr("alt")
      const image = $(el).find("img").attr("src")
      if (!href || !title) return
      results.push(
        new Manga({
          id: href.replace("/title/", ""),
          title,
          image
        })
      )
    })
    return { mangas: results }
  },

  // Manga details
  async mangaDetailsRequest(mangaId) {
    return this.requestManager.schedule(
      `${BASE_URL}/title/${mangaId}`,
      { method: "GET" }
    )
  },

  async mangaDetailsParse(response, mangaId) {
    const $ = this.cheerio.load(response.data)
    const title = $("h1").first().text().trim()
    const desc = $('meta[name="description"]').attr("content") ?? ""
    const image = $("img").first().attr("src")
    return new Manga({
      id: mangaId,
      title,
      desc,
      image,
      status: Manga.status.UNKNOWN
    })
  },

  // Chapters
  async chapterListRequest(mangaId) {
    return this.requestManager.schedule(
      `${BASE_URL}/title/${mangaId}`,
      { method: "GET" }
    )
  },

  async chapterListParse(response, mangaId) {
    const $ = this.cheerio.load(response.data)
    const chapters = []
    $("a[href*='-chapter-']").each((i, el) => {
      const href = $(el).attr("href")
      const name = $(el).text().trim() || `Chapter ${i + 1}`
      if (!href) return
      chapters.push(
        new Chapter({
          id: href.replace("/title/", ""),
          mangaId,
          name,
          langCode: "en"
        })
      )
    })
    return chapters.reverse()
  },

  // Pages
  async pageListRequest(chapterId) {
    return this.requestManager.schedule(
      `${BASE_URL}/title/${chapterId}`,
      { method: "GET" }
    )
  },

  async pageListParse(response, chapterId) {
    const html = response.data
    const match = html.match(/"chapter":({.*?})\s*,\s*"/s)
    if (!match) throw new Error("Chapter JSON not found")
    const chapterData = JSON.parse(match[1])
    return chapterData.images.map(
      (img, index) =>
        new Page({
          id: String(index),
          image: img.url
        })
    )
  }
})
