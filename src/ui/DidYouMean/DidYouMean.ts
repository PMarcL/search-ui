import {Component} from '../Base/Component';
import {ComponentOptions} from '../Base/ComponentOptions';
import {IComponentBindings} from '../Base/ComponentBindings';
import {Assert} from '../../misc/Assert';
import {QueryEvents, IBuildingQueryEventArgs, INoResultsEventArgs, IQuerySuccessEventArgs} from '../../events/QueryEvents';
import {$$} from '../../utils/Dom';
import {QueryStateModel} from '../../models/QueryStateModel';
import {Initialization} from '../Base/Initialization';
import {IQueryCorrection} from '../../rest/QueryCorrection';
import {StringUtils} from '../../utils/StringUtils';
import {Utils} from '../../utils/Utils';
import {AnalyticsActionCauseList, IAnalyticsNoMeta} from '../Analytics/AnalyticsActionListMeta';
import {l} from '../../strings/Strings';

export interface IDidYouMeanOptions {
  enableAutoCorrection?: boolean
}

/**
 * This component is responsible for displaying query corrections. If this component is in the page
 * and the query returns no results, but finds a possible query correction, the component either
 * suggests the correction or automatically triggers a new query with the suggested term.
 */
export class DidYouMean extends Component {
  static ID = 'DidYouMean';
  /**
   * The options for the component
   * @componentOptions
   */
  static options: IDidYouMeanOptions = {
    /**
     * This option allows the DidYouMean component to automatically trigger a new query
     * when there are no results and a correction is available <br/>
     * The default value is <code>true</code>
     */
    enableAutoCorrection: ComponentOptions.buildBooleanOption({ defaultValue: true }),
  };

  public correctedTerm: string;

  private hideNext: boolean;

  /**
   * Create a new DidYouMean component
   * @param element
   * @param options
   * @param bindings
   */
  constructor(public element: HTMLElement, public options?: IDidYouMeanOptions, public bindings?: IComponentBindings) {

    super(element, DidYouMean.ID, bindings);

    this.options = ComponentOptions.initComponentOptions(element, DidYouMean, options);
    Assert.exists(element);
    Assert.exists(this.options);

    this.hideNext = true;

    this.correctedTerm = null;

    this.bind.onRootElement(QueryEvents.buildingQuery, this.handlePrepareQueryBuilder);
    this.bind.onRootElement(QueryEvents.querySuccess, this.handleProcessNewQueryResults);
    this.bind.onRootElement(QueryEvents.noResults, this.handleNoResults);
    this.bind.onRootElement(QueryEvents.newQuery, this.handleNewQuery);
    $$(this.element).hide();
  }

  /**
   * Execute a query with the corrected term <br/>
   * Will throw an exception if the corrected term has not been initialized
   */
  public doQueryWithCorrectedTerm() {
    Assert.exists(this.correctedTerm);
    this.queryStateModel.set(QueryStateModel.attributesEnum.q, this.correctedTerm);
    this.queryController.deferExecuteQuery({
      beforeExecuteQuery: () => this.usageAnalytics.logSearchEvent<IAnalyticsNoMeta>(AnalyticsActionCauseList.didyoumeanClick, {})
    });
  }

  private handleNewQuery() {
    if (this.hideNext) {
      $$(this.element).empty();
      $$(this.element).hide();
      this.correctedTerm = null;
    } else {
      this.hideNext = true;
    }
  }

  private handlePrepareQueryBuilder(data: IBuildingQueryEventArgs) {
    Assert.exists(data);
    data.queryBuilder.enableDidYouMean = true;
  }

  private handleNoResults(data: INoResultsEventArgs) {
    // We do not auto-correct on search-as-you-type queries
    if (Utils.isNonEmptyArray(data.results.queryCorrections) && !data.searchAsYouType && this.options.enableAutoCorrection) {
      let originalQuery = this.queryStateModel.get(QueryStateModel.attributesEnum.q);
      this.correctedTerm = data.results.queryCorrections[0].correctedQuery;
      let correctedSentence = this.buildCorrectedSentence(data.results.queryCorrections[0]);
      this.queryStateModel.set(QueryStateModel.attributesEnum.q, data.results.queryCorrections[0].correctedQuery);
      data.retryTheQuery = true;
      this.hideNext = false;

      let noResultsFor = $$('div', { className: 'coveo-did-you-mean-no-results-for' }).el;
      noResultsFor.innerHTML = l('noResultFor', '<span class="coveo-highlight coveo-did-you-mean-highlight">' + StringUtils.htmlEncode(originalQuery) + '</span>');
      this.element.appendChild(noResultsFor);

      let automaticCorrect = $$('div', { className: 'coveo-did-you-mean-automatic-correct' }).el;
      automaticCorrect.innerHTML = l('autoCorrectedQueryTo', '<span class="coveo-highlight">' + correctedSentence + '</span>');
      this.element.appendChild(automaticCorrect);

      $$(this.element).show();
      this.usageAnalytics.logSearchEvent<IAnalyticsNoMeta>(AnalyticsActionCauseList.didyoumeanAutomatic, {});
    }
  }

  private handleProcessNewQueryResults(data: IQuerySuccessEventArgs) {
    Assert.exists(data);
    Assert.exists(data.results);

    let results = data.results;
    this.logger.trace('Received query results from new query', results);

    if (Utils.isNonEmptyArray(results.queryCorrections)) {
      let correctedSentence = this.buildCorrectedSentence(results.queryCorrections[0]);
      this.correctedTerm = results.queryCorrections[0].correctedQuery;
      let didYouMean = $$('div', { className: 'coveo-did-you-mean-suggestion' }, l('didYouMean', '')).el;
      this.element.appendChild(didYouMean);

      let searchTerm = $$('a', {}, correctedSentence).el;
      didYouMean.appendChild(searchTerm);

      $$(searchTerm).on('click', () => {
        this.doQueryWithCorrectedTerm();
      });

      $$(this.element).show();
    }
  }

  private buildCorrectedSentence(correction: IQueryCorrection) {
    let toReturn = [];
    let tagStart = '<span class=\'coveo-did-you-mean-word-correction\'>';
    let tagEnd = '</span>';
    let currentOffset = 0;
    _.each(correction.wordCorrections, (wordCorrection) => {
      toReturn.push(StringUtils.htmlEncode(correction.correctedQuery.slice(currentOffset, wordCorrection.offset)));
      currentOffset = wordCorrection.offset;
      toReturn.push(tagStart);
      toReturn.push(StringUtils.htmlEncode(correction.correctedQuery.slice(currentOffset, wordCorrection.length + currentOffset)));
      toReturn.push(tagEnd);
      currentOffset = wordCorrection.offset + wordCorrection.length;
    })
    toReturn.push(StringUtils.htmlEncode(correction.correctedQuery.slice(currentOffset)));
    return toReturn.join('');
  }
}

Initialization.registerAutoCreateComponent(DidYouMean);
