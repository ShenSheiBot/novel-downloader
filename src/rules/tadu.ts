import {
  BookAdditionalMetadate,
  attachmentClass,
  Chapter,
  Status,
} from "../main";
import { ruleClass, chapterParseObject } from "../rules";
import { getHtmlDOM, cleanDOM, console_debug, gfetch } from "../lib";
import { introDomHandle } from "./lib/common";
export class tadu implements ruleClass {
  public imageMode: "naive" | "TM";
  public concurrencyLimit: number;

  public constructor() {
    this.imageMode = "TM";
    this.concurrencyLimit = 5;
  }

  public async bookParse(chapterParse: ruleClass["chapterParse"]) {
    let bookUrl = document.location.href.replace("catalogue/", "");

    const bookname = (<HTMLElement>(
      document.querySelector("div.boxCenter > h1")
    )).innerText.trim();
    const author = (<HTMLElement>(
      document.querySelector(".itct > span:nth-child(1)")
    )).innerText
      .replace("作者：", "")
      .trim();

    const doc = await getHtmlDOM(bookUrl, undefined);
    const introDom = <HTMLElement>(
      doc.querySelector("div.boxCenter.bookIntro > div > p:nth-child(4)")
    );
    const [introduction, introductionHTML, introCleanimages] = introDomHandle(
      introDom
    );

    const additionalMetadate: BookAdditionalMetadate = {};
    const coverUrl = (<HTMLImageElement>(
      doc.querySelector("a.bookImg > img")
    )).getAttribute("data-src");
    if (coverUrl) {
      additionalMetadate.cover = new attachmentClass(
        coverUrl,
        `cover.${coverUrl.split(".").slice(-1)[0]}`,
        "TM"
      );
      additionalMetadate.cover.init();
    }

    const chapters: Chapter[] = [];
    const cos = document.querySelectorAll("div.chapter > a");
    let chapterNumber = 0;
    for (const aElem of Array.from(cos)) {
      chapterNumber++;
      const chapterName = (<HTMLAnchorElement>aElem).innerText;
      const chapterUrl = (<HTMLAnchorElement>aElem).href;
      const isVIP = () => {
        if (aElem.childElementCount) {
          return true;
        } else {
          return false;
        }
      };
      const isPaid = () => {
        //Todo
        return false;
      };
      const chapter = new Chapter(
        bookUrl,
        bookname,
        chapterUrl,
        chapterNumber,
        chapterName,
        isVIP(),
        isPaid(),
        null,
        null,
        null,
        chapterParse,
        "UTF-8",
        {}
      );
      const isLogin = () => {
        //Todo
        return false;
      };
      if (isVIP() && !(isLogin() && chapter.isPaid)) {
        chapter.status = Status.aborted;
      }
      chapters.push(chapter);
    }

    return {
      bookUrl: bookUrl,
      bookname: bookname,
      author: author,
      introduction: introduction,
      introductionHTML: introductionHTML,
      additionalMetadate: additionalMetadate,
      chapters: chapters,
    };
  }

  public async chapterParse(
    chapterUrl: string,
    chapterName: string | null,
    isVIP: boolean,
    isPaid: boolean,
    charset: string,
    options: object
  ) {
    async function publicChapter(): Promise<chapterParseObject> {
      console_debug(`[Chapter]请求 ${chapterUrl}`);
      const doc = await getHtmlDOM(chapterUrl, charset);

      const content = document.createElement("div");

      const _bookPartResourceUrl = doc
        .getElementById("bookPartResourceUrl")
        ?.getAttribute("value");
      if (_bookPartResourceUrl) {
        const bookPartResourceUrl = new URL(_bookPartResourceUrl);
        bookPartResourceUrl.searchParams.set("callback", "callback");

        console_debug(`[Chapter]请求 ${bookPartResourceUrl.toString()}`);
        const jsonpText = await gfetch(bookPartResourceUrl.toString(), {
          headers: {
            accept: "*/*",
            Referer: document.location.origin,
          },
        }).then((response) => {
          if (response.status >= 200 && response.status <= 299) {
            return response.responseText;
          } else {
            throw new Error(`Bad response! ${bookPartResourceUrl.toString()}`);
          }
        });

        interface contentObj {
          content: string;
        }
        const callback = (obj: object) => {
          return obj;
        };
        const contentObj: contentObj = eval(jsonpText);
        if (typeof contentObj === "object") {
          content.innerHTML = contentObj.content;
          let { dom, text, images } = cleanDOM(content, "TM");
          return {
            chapterName: chapterName,
            contentRaw: content,
            contentText: text,
            contentHTML: dom,
            contentImages: images,
            additionalMetadate: null,
          };
        }
      }
      return {
        chapterName: chapterName,
        contentRaw: null,
        contentText: null,
        contentHTML: null,
        contentImages: null,
        additionalMetadate: null,
      };
    }

    async function vipChapter(): Promise<chapterParseObject> {
      //Todo
      return {
        chapterName: chapterName,
        contentRaw: null,
        contentText: null,
        contentHTML: null,
        contentImages: null,
        additionalMetadate: null,
      };
    }

    if (isVIP) {
      return vipChapter();
    } else {
      return publicChapter();
    }
  }
}
