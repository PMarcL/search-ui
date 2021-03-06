


module Coveo {
  var HIGHLIGHT_PREFIX = "CoveoHighlight";

  export interface QuickviewDocumentOptions {
    maximumDocumentSize?: number;
  }

  interface Word {
    text: string;
    count: number;
    index: number;
    termsCount: number;
    element: HTMLElement;
    occurence: number;
  }

  interface WordState {
    word: Word;
    color: string;
    currentIndex: number;
    index: number;
  }

  export class QuickviewDocument extends Component {
    static ID = 'QuickviewDocument';

    static options: QuickviewDocumentOptions = {
      maximumDocumentSize: ComponentOptions.buildNumberOption({ defaultValue: 0, min: 0 }),
    };

    private iframe: JQuery;
    private header: JQuery;
    private termsToHighlightWereModified: boolean;
    private keywordsState: WordState[];

    constructor(public element: HTMLElement, public options?: QuickviewDocumentOptions, bindings?: IComponentBindings, public result?: IQueryResult) {
      super(element, QuickviewDocument.ID, bindings);

      this.options = ComponentOptions.initComponentOptions(element, QuickviewDocument, options);
      this.result = result || this.resolveResult();
      this.termsToHighlightWereModified = false;
      Assert.exists(this.result);
    }

    public createDom() {
      var container = $('<div class="coveo-quickview-document"></div>').appendTo($(this.element))
      this.header = this.buildHeader().appendTo(container);
      this.iframe = this.buildIFrame().appendTo(container);
    }

    public open() {
      this.ensureDom();
      var documentURL = $(this.element).attr('href');
      if (documentURL == undefined || documentURL == '') {
        documentURL = this.result.clickUri;
      }
      this.usageAnalytics.logClickEvent(AnalyticsActionCauseList.documentQuickview, {
        author: this.result.raw.author,
        documentURL: documentURL,
        documentTitle: this.result.title
      }, this.result, this.queryController.element);
      var beforeLoad = (new Date()).getTime();
      var iframe = <HTMLIFrameElement>this.iframe.find('iframe')[0];
      iframe.src = "about:blank";
      var endpoint = this.queryController.getEndpoint();

      var termsToHighlight = _.keys(this.result.termsToHighlight);
      var dataToSendOnOpenQuickView: IOpenQuickviewEventArgs = {
        termsToHighlight: termsToHighlight
      }

      $(this.element).trigger(UserActionEvents.openQuickview, dataToSendOnOpenQuickView);
      this.checkIfTermsToHighlightWereModified(dataToSendOnOpenQuickView.termsToHighlight);

      var queryObject = $.extend(true, {}, this.getBindings().queryController.getLastQuery());

      if (this.termsToHighlightWereModified) {
        this.handleTermsToHighlight(dataToSendOnOpenQuickView.termsToHighlight, queryObject);
      }

      var callOptions: IViewAsHtmlOptions = {
        queryObject: queryObject,
        requestedOutputSize: this.options.maximumDocumentSize
      };

      endpoint.getDocumentHtml(this.result.uniqueId, callOptions)
        .then((html: HTMLDocument) => {
          // If the contentDocument is null at this point it means that the Quick View
          // was closed before we've finished loading it. In this case do nothing.
          if (iframe.contentDocument == null) {
            return;
          }

          this.renderHTMLDocument(iframe, html);
          this.triggerQuickviewLoaded(beforeLoad);
        })
        .catch((error: AjaxError) => {
          // If the contentDocument is null at this point it means that the Quick View
          // was closed before we've finished loading it. In this case do nothing.
          if (iframe.contentDocument == null) {
            return;
          }

          if (error.status != 0) {
            this.renderErrorReport(iframe);
            this.triggerQuickviewLoaded(beforeLoad);
          } else {
            iframe.onload = () => {
              this.triggerQuickviewLoaded(beforeLoad);
            }
            iframe.src = endpoint.getViewAsHtmlUri(this.result.uniqueId, callOptions);
          }
        });
    }

    protected renderHTMLDocument(iframe: HTMLIFrameElement, html: HTMLDocument) {
      iframe.onload = () => {
        this.computeHighlights(iframe.contentWindow);

        //Remove white border for new Quickview
        if (this.isNewQuickviewDocument(iframe.contentWindow)) {
          $(this.element).parents(".coveo-body").css("padding", 0);
          $(this.element).children(".coveo-quickview-header").css("padding-top", 10);
          $(this.element).children(".coveo-quickview-header").css("padding-left", 10);
        }

        if ($(this.element).children(".coveo-quickview-header").html() == "") {
          $(this.element).children(".coveo-quickview-header").css("display", "none");
        }
      };

      this.writeToIFrame(iframe, html);
      this.wrapPreElementsInIframe(iframe);
      if (DeviceUtils.isMobileDevice()) {
        this.bindOpenIframeLinksInPhonegap(iframe);
      }
    }


    private renderErrorReport(iframe: HTMLIFrameElement) {
      var errorMessage = "<html><body style='font-family: Arimo, \"Helvetica Neue\", Helvetica, Arial, sans-serif; -webkit-text-size-adjust: none;'>" + l("OopsError") + "</body></html>";
      this.writeToIFrame(iframe, errorMessage);
    }

    private writeToIFrame(iframe: HTMLIFrameElement, content: HTMLDocument);
    private writeToIFrame(iframe: HTMLIFrameElement, content: String);
    private writeToIFrame(iframe: HTMLIFrameElement, content: any) {
      var toWrite = content;
      //This sucks because we can't do instanceof HTMLDocument
      //lib.d.ts declare HTMLDocument as an interface, not an actual object
      if (typeof content == "object") {
        toWrite = content.getElementsByTagName("html")[0].outerHTML;
      }
      iframe.contentWindow.document.open();
      iframe.contentWindow.document.write(toWrite);
      iframe.contentWindow.document.close();
    }

    private bindOpenIframeLinksInPhonegap(iframe: HTMLIFrameElement) {
      try {
        var iframeLinks = $(iframe.contentWindow.document).find('a');
        _.each(iframeLinks, (link) => {
          var href = link["href"];
          link["href"] = 'javascript:';
          PhonegapUtils.bindOpenLinkInPhonegap(link, href);
        });
      } catch (e) {
        // if not allowed
      }
    }

    private wrapPreElementsInIframe(iframe: HTMLIFrameElement) {
      try {
        var style = document.createElement('style');
        style.type = 'text/css';

        // This CSS forces <pre> tags used in some emails to wrap by default
        var cssText = 'html pre { white-space: pre-wrap; white-space: -moz-pre-wrap; white-space: -pre-wrap; white-space: -o-pre-wrap; word-wrap: break-word; }';

        // Some people react strongly when presented with their browser's default font, so let's fix that
        cssText += 'body, html { font-family: Arimo, "Helvetica Neue", Helvetica, Arial, sans-serif; -webkit-text-size-adjust: none; }';

        if (DeviceUtils.isIos()) {
          // Safari on iOS forces resize iframes to fit their content, even if an explicit size
          // is set on the iframe. Isn't that great? By chance there is a trick around it: by
          // setting a very small size on the body and instead using min-* to set the size to
          // 100% we're able to trick Safari from thinking it must expand the iframe. Amazed.
          // The 'scrolling' part is required otherwise the hack doesn't work.
          //
          // http://stackoverflow.com/questions/23083462/how-to-get-an-iframe-to-be-responsive-in-ios-safari
          cssText += 'body, html { height: 1px !important; min-height: 100%; overflow: scroll; }';
          $(iframe).attr('scrolling', 'no');

          //Some content is cropped on iOs if a margin is present
          //We remove it and add one on the iframe wrapper.
          cssText += 'body, html {margin: auto}';
          $(iframe).parent().css("margin", "0 0 5px 5px")

          // While we're on the topic of iOS Safari: This magic trick prevents iOS from NOT
          // displaying the content of the iframe. If we don't do this, you'll see the body
          // of the iframe ONLY when viewing the page in the tab switcher.  Isn't that *magical*?
          iframe.style.position = 'relative';
        }

        if ('styleSheet' in style) {
          style['styleSheet'].cssText = cssText;
        } else {
          style.appendChild(document.createTextNode(cssText));
        }
        var head = iframe.contentWindow.document.head;
        head.appendChild(style);
      } catch (e) {
        // if not allowed
      }
    }

    private triggerQuickviewLoaded(beforeLoad: number) {
      var afterLoad = (new Date()).getTime();
      var eventArgs: QuickviewLoadedEventArgs = { duration: afterLoad - beforeLoad };
      $(this.element).trigger(UserActionEvents.quickviewLoaded, eventArgs);
    }

    // An highlighted term looks like:
    //
    //     <span id="CoveoHighlight:X.Y.Z">a</span>
    //
    // The id has 3 components:
    // - X: the term
    // - Y: the term occurence
    // - Z: the term part
    //
    // For the "Z" component, if the term "foo bar" is found in multiple elements, we will see:
    //
    //     <span id="CoveoHighlight:1.1.1">foo</span>
    //     <span id="CoveoHighlight:1.1.2">bar</span>
    //
    // Highlighted words can overlap, which looks like:
    //
    //     <span id="CoveoHighlight:1.Y.Z">
    //         a
    //         <coveotaggedword id="CoveoHighlight:2.Y.Z">b</coveotaggedword>
    //     </span>
    //     <span id="CoveoHighlight:2.Y.Z">c</span>
    //
    // In the previous example, the words "ab" and "bc" are highlighted.
    //
    // One thing important to note is that the id of all "coveotaggedword" for
    // the same word AND the first "span" for that word will have the same id.
    //
    // Example:
    //
    //     <span id="CoveoHighlight:1.1.1">
    //         a
    //         <coveotaggedword id="CoveoHighlight:2.1.1">b</coveotaggedword>
    //     </span>
    //     <span id="CoveoHighlight:1.1.2">
    //         c
    //         <coveotaggedword id="CoveoHighlight:2.1.1">d</coveotaggedword>
    //     </span>
    //     <span id="CoveoHighlight:2.1.1">e</span>
    //     <span id="CoveoHighlight:2.1.2">f</span>
    //
    // In the previous example, the words "abcd" and "bcdef" are highlighted.
    //
    // This method is public for testing purposes.
    //
    public computeHighlights(window: Window): string[] {
      this.header.empty();
      this.keywordsState = [];

      var words: { [index: string]: Word } = {};
      var highlightsCount = 0;

      $(window.document.body)
        .find('[id^=' + HIGHLIGHT_PREFIX + ']')
        .each((index, element: HTMLElement) => {
          var idParts = this.getHighlightIdParts(element);

          if (idParts) {
            var idIndexPart = idParts[1];                    // X
            var idOccurencePart = parseInt(idParts[2], 10);  // Y
            var idTermPart = parseInt(idParts[3], 10);       // Z in <span id="CoveoHighlight:X.Y.Z">a</span>

            var word = words[idIndexPart];

            // The "idTermPart" check is to circumvent a bug from the index
            // where an highlight of an empty string start with an idTermPart > 1.
            if (word == null && idTermPart == 1) {
              words[idIndexPart] = word = {
                text: this.getHighlightInnerText(element),
                count: 1,
                index: parseInt(idIndexPart, 10),

                // Here I try to be clever.
                // An overlaping word:
                // 1) always start with a "coveotaggedword" element.
                // 2) then other "coveotaggedword" elements may follow
                // 3) then a "span" element may follow.
                //
                // All 1), 2) and 3) will have the same id so I consider them as
                // a whole having the id 0 instead of 1.
                termsCount: element.nodeName.toLowerCase() == "coveotaggedword" ? 0 : 1,
                element: element,
                occurence: idOccurencePart
              };
            } else if (word) {
              if (word.occurence == idOccurencePart) {
                if (element.nodeName.toLowerCase() == "coveotaggedword") {
                  word.text += this.getHighlightInnerText(element);
                  // Doesn't count as a term part (see method description for more info).
                } else if (word.termsCount < idTermPart) {
                  word.text += this.getHighlightInnerText(element);
                  word.termsCount += 1;
                }
              }

              word.count = Math.max(word.count, idOccurencePart);
              highlightsCount += 1;
            }

            // See the method description to understand why this code let us
            // create the word "bcdef" instead of "bdef".
            if (word && word.occurence == idOccurencePart && element.nodeName.toLowerCase() == "span") {
              var embeddedWordParts = this.getHightlightEmbeddedWordIdParts(element);
              var embeddedWord = embeddedWordParts ? words[embeddedWordParts[1]] : null;

              if (embeddedWord && embeddedWord.occurence == parseInt(embeddedWordParts[2], 10)) {
                embeddedWord.text += element.childNodes[0].nodeValue || ""; // only immediate text without children.
              }
            }
          }
        });

      if (highlightsCount == 0) {
        this.header.css("min-height", 0);
      }

      var resolvedWords = [];

      _.each(words, (word) => {
        // When possible, take care to find the original term from the query instead of the
        // first highlighted version we encounter. This relies on a recent feature by the
        // Search API, but will fallback properly on older versions.
        word.text = this.resolveOriginalTermFromHighlight(word.text);

        var state = {
          word: word,
          color: word.element.style.backgroundColor,
          currentIndex: 0,
          index: word.index
        }

        this.keywordsState.push(state);
        this.header.append(this.buildWordButton(state, window));

        resolvedWords.push(word.text);
      });

      return resolvedWords;
    }

    private getHighlightIdParts(element: HTMLElement): string[] {
      var parts = element
        .id
        .substr(HIGHLIGHT_PREFIX.length + 1)
        .match(/^([0-9]+)\.([0-9]+)\.([0-9]+)$/);

      return (parts && parts.length > 3) ? parts : null;
    }

    private getHighlightInnerText(element: HTMLElement): string {
      if (element.nodeName.toLowerCase() == "coveotaggedword") {
        // only immediate text without children.
        return element.childNodes.length >= 1 ? (element.childNodes.item(0).textContent || "") : "";
      } else {
        return element.textContent || "";
      }
    }

    private getHightlightEmbeddedWordIdParts(element: HTMLElement): string[] {
      var embedded = element.getElementsByTagName('coveotaggedword')[0];

      return embedded ? this.getHighlightIdParts(<HTMLElement>embedded) : null;
    }

    private resolveOriginalTermFromHighlight(highlight: string): string {
      var found = highlight;

      // Beware, terms to highlight is only set by recent search APIs.
      if (this.result.termsToHighlight) {
        // We look for the term expansion and we'll return the corresponding
        // original term is one is found.
        found = _.find(_.keys(this.result.termsToHighlight), (originalTerm: string) => {
          // The expansions do NOT include the original term (makes sense), so be sure to check
          // the original term for a match too.
          return (originalTerm.toLowerCase() == highlight.toLowerCase()) ||
            (_.find(this.result.termsToHighlight[originalTerm], (expansion: string) => expansion.toLowerCase() == highlight.toLowerCase()) != undefined)
        }) || found;
      }
      return found;
    }

    private buildWordButton(wordState: WordState, window: Window) {
      var wordHtml = $('<span/>').addClass('coveo-term-for-quickview');

      wordHtml.append($('<span/>').addClass('coveo-term-for-quickview-name').html(wordState.word.text).click(() => {
        this.navigate(wordState, false, window);
      }));

      wordHtml.append($('<span/>').addClass('coveo-term-for-quickview-down-arrow').append($('<span/>').addClass('coveo-term-for-quickview-down-arrow-icon')).click(() => {
        this.navigate(wordState, false, window);
      }));

      wordHtml.append($('<span/>').addClass('coveo-term-for-quickview-up-arrow').append($('<span/>').addClass('coveo-term-for-quickview-up-arrow-icon')).click(() => {
        this.navigate(wordState, true, window);
      }));

      wordHtml.css('background-color', wordState.color);
      wordHtml.css('border-color', this.getSaturatedColor(wordState.color));
      wordHtml.find('.coveo-term-for-quickview-down-arrow').css('border-color', this.getSaturatedColor(wordState.color))

      return wordHtml;
    }

    private navigate(state: WordState, backward: boolean, window: Window) {
      var fromIndex = state.currentIndex;
      var toIndex: number;
      if (!backward) {
        toIndex = fromIndex == state.word.count ? 1 : fromIndex + 1;
      } else {
        toIndex = fromIndex <= 1 ? state.word.count : fromIndex - 1;
      }

      var scroll = this.getScrollingElement(window);

      // Un-highlight any currently selected element
      scroll.find('[id^="' + HIGHLIGHT_PREFIX + ':' + state.word.index + '.' + fromIndex + '"]')
        .css('border', '');

      // Find and highlight the new element.
      var element = $(window.document.body).find('[id^="' + HIGHLIGHT_PREFIX + ':' + state.word.index + '.' + toIndex + '."]');
      element.css('border', '1px dotted #333');
      state.currentIndex = toIndex;

      // pdf2html docs hide the non-visible frames by default, to speed up browsers.
      // But this prevents keyword navigation from working so we must force show it. This
      // is done by adding the 'opened' class to it (defined by pdf2html).
      if (this.isNewQuickviewDocument(window)) {
        element.closest('.pc').addClass('opened');
      }

      // pdf2html docs hide the non-visible frames by default, to speed up browsers.
      // Hack for now: the new Quick View is far too complex to manually scroll
      // to the content, so SCREW IT and use good ol' scrollIntoView. I'm planning
      // on a page-based quick view in an upcoming hackaton anyway :)
      //
      // Also, mobile devices have troubles with the animation.
      if (this.isNewQuickviewDocument(window) || DeviceUtils.isMobileDevice()) {
        element[0].scrollIntoView();

        // iOS on Safari might scroll the whole modal box body when we do this,
        // so give it a nudge in the right direction.
        this.iframe.closest('.coveo-body').scrollLeft(0).scrollTop(0);

        return;
      }

      // For other quick views we use a nicer animation that centers the keyword
      var offset = element.offset();
      scroll.stop(true).animate({
        scrollLeft: offset.left - scroll.get(0).clientWidth / 2 + element.width() / 2,
        scrollTop: offset.top - scroll.get(0).clientHeight / 2 + element.height() / 2
      });
      this.iframe.stop(true).animate({
        scrollLeft: offset.left - this.iframe.width() / 2 + element.width() / 2,
        scrollTop: offset.top - this.iframe.height() / 2 + element.height() / 2
      });
    }

    private buildHeader(): JQuery {
      return $('<div/>').addClass('coveo-quickview-header');
    }

    private buildIFrame(): JQuery {
      var iFrame = $('<iframe />');
      iFrame.attr('sandbox', 'allow-same-origin');
      return $('<div class="coveo-iframeWrapper"></div>').append(iFrame);
    }

    private getScrollingElement(iframeWindow: Window): JQuery {
      var found: JQuery;

      if (this.isNewQuickviewDocument(iframeWindow)) {
        // "New" quick views have a #page-container element generated by the pdf2html thing.
        // This is the element we want to scroll on.
        found = $(iframeWindow.document.body).find("#page-container");
      }

      // If all else fails, we use the body
      if (found == undefined || found.length == 0) {
        found = $(iframeWindow.document.body);
      }

      return found;
    }

    private isNewQuickviewDocument(iframeWindow: Window): boolean {
      return $(iframeWindow.document.head).find("meta[name='generator']").attr('content') == 'pdf2htmlEX';
    }

    private handleTermsToHighlight(termsToHighlight: Array<string>, queryObject: IQuery) {
      for (var term in this.result.termsToHighlight) {
        delete this.result.termsToHighlight[term];
      }
      var query = "";
      _.each(termsToHighlight, (term) => {
        query += term + " ";
        this.result.termsToHighlight[term] = new Array<string>(term);
      });
      query = query.substring(0, query.length - 1);
      queryObject.q = query;
    }

    private checkIfTermsToHighlightWereModified(termsToHighlight: Array<string>) {
      if (!Utils.arrayEqual(termsToHighlight, _.keys(this.result.termsToHighlight))) {
        this.termsToHighlightWereModified = true;
      }
    }

    private getSaturatedColor(color: string): string {
      var r = parseInt(color.substring(4, 7));
      var g = parseInt(color.substring(9, 12));
      var b = parseInt(color.substring(14, 17));
      var hsv = ColorUtils.rgbToHsv(r, g, b);
      hsv[1] *= 2;
      if (hsv[1] > 1) {
        hsv[1] = 1;
      }
      var rgb = ColorUtils.hsvToRgb(hsv[0], hsv[1], hsv[2])
      return 'rgb(' + rgb[0].toString() + ', ' + rgb[1].toString() + ', ' + rgb[2].toString() + ')';
    }
  }

  Initialization.registerAutoCreateComponent(QuickviewDocument);
}
