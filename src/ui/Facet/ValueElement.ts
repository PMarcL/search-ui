/// <reference path="Facet.ts" />
import {Facet} from './Facet';
import {FacetValue} from './FacetValues';
import {IPopulateOmniboxObject} from '../Omnibox/OmniboxInterface';
import {ValueElementRenderer} from './ValueElementRenderer';
import {Utils} from '../../utils/Utils';
import {IAnalyticsActionCause, AnalyticsActionCauseList, IAnalyticsFacetMeta} from '../Analytics/AnalyticsActionListMeta';
import {$$} from '../../utils/Dom';
import {DeviceUtils} from '../../utils/DeviceUtils';
import {Defer} from '../../misc/Defer';

declare const Coveo;

export interface ValueElementKlass {
  new (facet: Facet, facetValue: FacetValue): ValueElement;
}

export interface ValueElementEventsBinding {
  displayNextTime: boolean;
  pinFacet: boolean;
  omniboxObject?: IPopulateOmniboxObject;
}

export class ValueElement {
  public renderer: ValueElementRenderer;
  private isOmnibox: boolean;

  constructor(public facet: Facet, public facetValue: FacetValue, public onSelect?: (elem: ValueElement, cause: IAnalyticsActionCause) => void, public onExclude?: (elem: ValueElement, cause: IAnalyticsActionCause) => void) {
  }

  public build(): ValueElement {
    this.renderer = new ValueElementRenderer(this.facet, this.facetValue).build();
    this.bindEvent({ displayNextTime: true, pinFacet: this.facet.options.preservePosition });
    return this;
  }

  public bindEvent(eventBindings: ValueElementEventsBinding) {
    if (!Utils.isNullOrUndefined(eventBindings.omniboxObject)) {
      this.isOmnibox = true;
    } else {
      this.isOmnibox = false;
    }
    this.handleEventForCheckboxChange(eventBindings);
    if (this.facetValue.excluded) {
      this.handleEventForExcludedValueElement(eventBindings);
    } else {
      this.handleEventForValueElement(eventBindings);
    }
  }

  public select() {
    this.facetValue.selected = true;
    this.facetValue.excluded = false;
    this.renderer.setCssClassOnListValueElement();
  }

  public unselect() {
    this.facetValue.selected = false;
    this.facetValue.excluded = false;
    this.renderer.setCssClassOnListValueElement();
  }

  public exclude() {
    this.facetValue.selected = false;
    this.facetValue.excluded = true;
    this.renderer.setCssClassOnListValueElement();
  }

  public unexclude() {
    this.facetValue.selected = false;
    this.facetValue.excluded = false;
    this.renderer.setCssClassOnListValueElement();
  }

  protected handleSelectValue(eventBindings: ValueElementEventsBinding) {
    this.facet.keepDisplayedValuesNextTime = eventBindings.displayNextTime && !this.facet.options.useAnd;
    var actionCause: IAnalyticsActionCause;
    if (this.facetValue.excluded) {
      actionCause = this.isOmnibox ? AnalyticsActionCauseList.omniboxFacetUnexclude : AnalyticsActionCauseList.facetUnexclude;
      this.facet.unexcludeValue(this.facetValue);
    } else {
      if (this.facetValue.selected) {
        actionCause = this.isOmnibox ? AnalyticsActionCauseList.omniboxFacetDeselect : AnalyticsActionCauseList.facetDeselect;
      } else {
        actionCause = this.isOmnibox ? AnalyticsActionCauseList.omniboxFacetSelect : AnalyticsActionCauseList.facetSelect;
      }
      this.facet.toggleSelectValue(this.facetValue);
    }
    if (this.onSelect) {
      this.facet.triggerNewQuery(() => this.onSelect(this, actionCause));
    } else {
      this.facet.triggerNewQuery(() => this.facet.usageAnalytics.logSearchEvent<IAnalyticsFacetMeta>(actionCause, this.getAnalyticsFacetMeta()));
    }
  }

  protected handleExcludeClick(eventBindings: ValueElementEventsBinding) {
    this.facet.keepDisplayedValuesNextTime = eventBindings.displayNextTime && !this.facet.options.useAnd;
    var actionCause: IAnalyticsActionCause;
    if (this.facetValue.excluded) {
      actionCause = this.isOmnibox ? AnalyticsActionCauseList.omniboxFacetUnexclude : AnalyticsActionCauseList.facetUnexclude;
    } else {
      actionCause = this.isOmnibox ? AnalyticsActionCauseList.omniboxFacetExclude : AnalyticsActionCauseList.facetExclude;
    }
    this.facet.toggleExcludeValue(this.facetValue);
    if (this.onExclude) {
      this.facet.triggerNewQuery(() => this.onExclude(this, actionCause));
    } else {
      this.facet.triggerNewQuery(() => this.facet.usageAnalytics.logSearchEvent<IAnalyticsFacetMeta>(actionCause, this.getAnalyticsFacetMeta()));
    }
  }

  protected handleEventForExcludedValueElement(eventBindings: ValueElementEventsBinding) {
    $$(this.renderer.label).on('click', (event) => {
      if (eventBindings.pinFacet) {
        this.facet.pinFacetPosition();
      }
      if (eventBindings.omniboxObject) {
        this.omniboxCloseEvent(eventBindings.omniboxObject);
      }
      this.handleSelectValue(eventBindings);
      event.stopPropagation();
      return false;
    })
  }

  protected handleEventForValueElement(eventBindings: ValueElementEventsBinding) {
    $$(this.renderer.excludeIcon).on('click', (event) => {
      if (eventBindings.omniboxObject) {
        this.omniboxCloseEvent(eventBindings.omniboxObject);
      }
      this.handleExcludeClick(eventBindings);
      event.stopPropagation();
      return false;
    })
    $$(this.renderer.label).on('click', (event: Event) => {
      if (eventBindings.pinFacet) {
        this.facet.pinFacetPosition();
      }
      event.preventDefault();
      $$(this.renderer.checkbox).trigger('change');
      return false;
    })
  }

  protected handleEventForCheckboxChange(eventBindings: ValueElementEventsBinding) {
    $$(this.renderer.checkbox).on('change', () => {
      if (eventBindings.omniboxObject) {
        this.omniboxCloseEvent(eventBindings.omniboxObject);
      }

      this.handleSelectValue(eventBindings);
      if (DeviceUtils.isMobileDevice() && !this.facet.searchInterface.isNewDesign() && this.facet.options.enableFacetSearch) {
        Defer.defer(() => {
          Coveo.ModalBox.close(true);
          this.facet.facetSearch.completelyDismissSearch();
        });
      }
    })
  }

  protected omniboxCloseEvent(eventArg: IPopulateOmniboxObject) {
    eventArg.closeOmnibox();
    eventArg.clear();
  }

  private getAnalyticsFacetMeta(): IAnalyticsFacetMeta {
    return {
      facetId: this.facet.options.id,
      facetValue: this.facetValue.value,
      facetTitle: this.facet.options.title
    }
  }
}
