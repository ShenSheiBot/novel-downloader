import { getImageAttachment } from "../../lib/attachments";
import { cleanDOM } from "../../lib/cleanDOM";
import { getHtmlDOM } from "../../lib/http";
import { PublicConstructor } from "../../lib/misc";
import { log } from "../../log";
import { Book, BookAdditionalMetadate, Chapter } from "../../main";
import { BaseRuleClass, ChapterParseObject } from "../../rules";
import { introDomHandle } from "../lib/common";

export async function bookParseTemp({
  bookUrl,
  bookname,
  author,
  introDom,
  introDomPatch,
  coverUrl,
  chapterListSelector,
  charset,
  chapterParse,
}: {
  bookUrl: string;
  bookname: string;
  author: string;
  introDom: HTMLElement;
  introDomPatch: (introDom: HTMLElement) => HTMLElement;
  coverUrl: string;
  chapterListSelector: string;
  charset: string;
  chapterParse: BaseRuleClass["chapterParse"];
}): Promise<Book> {
  const [introduction, introductionHTML, introCleanimages] =
    await introDomHandle(introDom, introDomPatch);

  const additionalMetadate: BookAdditionalMetadate = {};
  if (coverUrl) {
    getImageAttachment(coverUrl, "TM", "cover-")
      .then((coverClass) => {
        additionalMetadate.cover = coverClass;
      })
      .catch((error) => log.error(error));
  }

  const chapters: Chapter[] = [];
  const dl = document.querySelector(chapterListSelector);
  if (dl?.childElementCount) {
    const dlc = Array.from(dl.children);
    if (
      dlc[0].nodeName === "DT" &&
      ((dlc[0] as HTMLTableDataCellElement).innerText.includes("最新章节") ||
        (dlc[0] as HTMLTableDataCellElement).innerText.includes(
          "最新的八个章节"
        ))
    ) {
      for (let i = 0; i < dl?.childElementCount; i++) {
        if (i !== 0 && dlc[i].nodeName === "DT") {
          delete dlc[0];
          break;
        }
        delete dlc[i];
      }
    }

    const chapterList = dlc.filter((obj) => obj !== undefined);
    let chapterNumber = 0;
    let sectionNumber = 0;
    let sectionName = null;
    let sectionChapterNumber = 0;
    for (const node of chapterList as HTMLElement[]) {
      if (node.nodeName === "DT") {
        sectionNumber++;
        sectionChapterNumber = 0;
        if (node.innerText.includes("《")) {
          sectionName = node.innerText.replace(`《${bookname}》`, "").trim();
        } else {
          sectionName = node.innerText.replace(`${bookname}`, "").trim();
        }
      } else if (node.nodeName === "DD") {
        if (node.childElementCount === 0) {
          continue;
        }
        chapterNumber++;
        sectionChapterNumber++;
        const a = node.firstElementChild as HTMLLinkElement;
        const chapterName = a.innerText;
        const chapterUrl = a.href;
        const isVIP = false;
        const isPaid = false;
        const chapter = new Chapter(
          bookUrl,
          bookname,
          chapterUrl,
          chapterNumber,
          chapterName,
          isVIP,
          isPaid,
          sectionName,
          sectionNumber,
          sectionChapterNumber,
          chapterParse,
          charset,
          { bookname }
        );
        chapters.push(chapter);
      }
    }
  }

  const book = new Book(
    bookUrl,
    bookname,
    author,
    introduction,
    introductionHTML,
    additionalMetadate,
    chapters
  );
  return book;
}

export interface ChapterParseOption {
  bookname: string;
}
export async function chapterParseTemp({
  dom,
  chapterUrl,
  chapterName,
  contenSelector,
  contentPatch,
  charset,
}: {
  dom: Document;
  chapterUrl: string;
  chapterName: string;
  contenSelector: string;
  contentPatch: (content: HTMLElement) => HTMLElement;
  charset: string;
}): Promise<ChapterParseObject> {
  let content = dom.querySelector(contenSelector) as HTMLElement;
  if (content) {
    content = contentPatch(content);
    const { dom: domClean, text, images } = await cleanDOM(content, "TM");
    return {
      chapterName,
      contentRaw: content,
      contentText: text,
      contentHTML: domClean,
      contentImages: images,
      additionalMetadate: null,
    };
  } else {
    return {
      chapterName,
      contentRaw: null,
      contentText: null,
      contentHTML: null,
      contentImages: null,
      additionalMetadate: null,
    };
  }
}

export function mkBiqugeClass(
  introDomPatch: (introDom: HTMLElement) => HTMLElement,
  contentPatch: (content: HTMLElement) => HTMLElement,
  concurrencyLimit?: number
): PublicConstructor<BaseRuleClass> {
  return class extends BaseRuleClass {
    public constructor() {
      super();
      if (typeof concurrencyLimit === "number") {
        this.concurrencyLimit = concurrencyLimit;
      }
      this.imageMode = "TM";
      this.charset = document.charset;
      this.overrideConstructor(this);
    }

    public async bookParse() {
      const self = this;
      return bookParseTemp({
        bookUrl: document.location.href,
        bookname: (
          document.querySelector("#info h1:nth-of-type(1)") as HTMLElement
        ).innerText
          .trim()
          .replace(/最新章节$/, ""),
        author: (
          document.querySelector("#info > p:nth-child(2)") as HTMLElement
        ).innerText
          .replace(/作(\s+)?者[：:]/, "")
          .trim(),
        introDom: document.querySelector("#intro") as HTMLElement,
        introDomPatch,
        coverUrl: (document.querySelector("#fmimg > img") as HTMLImageElement)
          .src,
        chapterListSelector: "#list>dl",
        charset: document.charset,
        chapterParse: self.chapterParse,
      });
    }

    public async chapterParse(
      chapterUrl: string,
      chapterName: string | null,
      isVIP: boolean,
      isPaid: boolean,
      charset: string,
      options: object
    ) {
      const dom = await getHtmlDOM(chapterUrl, charset);
      return chapterParseTemp({
        dom,
        chapterUrl,
        chapterName: (
          dom.querySelector(".bookname > h1:nth-child(1)") as HTMLElement
        ).innerText.trim(),
        contenSelector: "#content",
        contentPatch,
        charset,
      });
    }

    public overrideConstructor(self: this) {
      // overrideConstructor
    }
  };
}

export function mkBiqugeClass2(
  introDomPatch: (introDom: HTMLElement) => HTMLElement,
  contentPatch: (content: HTMLElement) => HTMLElement,
  concurrencyLimit?: number
): PublicConstructor<BaseRuleClass> {
  // tslint:disable-next-line:max-classes-per-file
  return class extends BaseRuleClass {
    public constructor() {
      super();
      if (typeof concurrencyLimit === "number") {
        this.concurrencyLimit = concurrencyLimit;
      }
      this.imageMode = "TM";
      this.charset = document.charset;
      this.overrideConstructor(this);
    }

    public async bookParse() {
      const self = this;
      return bookParseTemp({
        bookUrl: document.location.href,
        bookname: (
          document.querySelector(".info > h2") as HTMLElement
        ).innerText
          .trim()
          .replace(/最新章节$/, ""),
        author: (
          document.querySelector(".small > span:nth-child(1)") as HTMLElement
        ).innerText
          .replace(/作(\s+)?者[：:]/, "")
          .trim(),
        introDom: document.querySelector(".intro") as HTMLElement,
        introDomPatch,
        coverUrl: (
          document.querySelector(".info > .cover > img") as HTMLImageElement
        ).src,
        chapterListSelector: ".listmain>dl",
        charset: document.charset,
        chapterParse: self.chapterParse,
      });
    }

    public async chapterParse(
      chapterUrl: string,
      chapterName: string | null,
      isVIP: boolean,
      isPaid: boolean,
      charset: string,
      options: object
    ) {
      const dom = await getHtmlDOM(chapterUrl, charset);
      return chapterParseTemp({
        dom,
        chapterUrl,
        chapterName: (
          dom.querySelector(".content > h1:nth-child(1)") as HTMLElement
        ).innerText.trim(),
        contenSelector: "#content",
        contentPatch,
        charset,
      });
    }

    public overrideConstructor(self: this) {
      // overrideConstructor
    }
  };
}