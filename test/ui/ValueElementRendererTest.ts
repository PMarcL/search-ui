/// <reference path="../Test.ts" />

module Coveo {
  describe('ValueElementRenderer', function () {
    var facet: Facet;
    var valueRenderer: ValueElementRenderer;

    beforeEach(function () {
      facet = Mock.optionsComponentSetup<Facet, IFacetOptions>(Facet, {
        field: '@field'
      }).cmp;
    })

    afterEach(function () {
      facet = null;
      valueRenderer = null;
    })

    it('should build a list element', function () {
      valueRenderer = new ValueElementRenderer(facet, FacetValue.createFromFieldValue(FakeResults.createFakeFieldValue('foo', 1234)));
      expect(valueRenderer.build().listElement).toBeDefined();
      expect(valueRenderer.build().listElement.getAttribute('data-value')).toBe('foo');
    })

    it('should build a label', function () {
      valueRenderer = new ValueElementRenderer(facet, FacetValue.createFromFieldValue(FakeResults.createFakeFieldValue('foo', 123)));
      expect(valueRenderer.build().label).toBeDefined();
    })

    it('should build a checkbox', function () {
      valueRenderer = new ValueElementRenderer(facet, FacetValue.createFromFieldValue(FakeResults.createFakeFieldValue('foo', 123)));
      valueRenderer.facetValue.selected = true;
      valueRenderer.facetValue.excluded = false;
      expect(valueRenderer.build().checkbox.getAttribute('checked')).toBe('checked');
      expect(valueRenderer.build().checkbox.getAttribute('disabled')).toBeNull();
      valueRenderer.facetValue.selected = false;
      valueRenderer.facetValue.excluded = true;
      expect(valueRenderer.build().checkbox.getAttribute('checked')).toBeNull();
      expect(valueRenderer.build().checkbox.getAttribute('disabled')).toBe('disabled');
    })

    it('should build a stylish checkbox', function () {
      valueRenderer = new ValueElementRenderer(facet, FacetValue.createFromFieldValue(FakeResults.createFakeFieldValue('foo', 123)));
      expect(valueRenderer.build().stylishCheckbox).toBeDefined();
    })

    it('should build a caption', function () {
      valueRenderer = new ValueElementRenderer(facet, FacetValue.createFromFieldValue(FakeResults.createFakeFieldValue('this is a nice value', 123)));
      expect(valueRenderer.build().valueCaption).toBeDefined();
      expect($$(valueRenderer.build().valueCaption).text()).toBe('this is a nice value');
    })

    it('should build a value count', function () {
      valueRenderer = new ValueElementRenderer(facet, FacetValue.createFromFieldValue(FakeResults.createFakeFieldValue('foo', 1)));
      expect(valueRenderer.build().valueCount).toBeDefined();
      expect($$(valueRenderer.build().valueCount).text()).toBe('1');

      // Should format big number
      valueRenderer.facetValue.occurrences = 31416;
      expect($$(valueRenderer.build().valueCount).text()).toBe('31,416');
    })

    it('should build an exclude icon', function () {
      valueRenderer = new ValueElementRenderer(facet, FacetValue.createFromFieldValue(FakeResults.createFakeFieldValue('foo', 123)));
      expect(valueRenderer.build().excludeIcon).toBeDefined();
    })

    it('should render computed field only if needed', function () {
      valueRenderer = new ValueElementRenderer(facet, FacetValue.createFromFieldValue(FakeResults.createFakeFieldValue('foo', 123)));
      expect(valueRenderer.build().computedField).toBeUndefined();

      valueRenderer.facet.options.computedField = '@computedField';
      valueRenderer.facet.options.computedFieldOperation = 'sum';
      valueRenderer.facet.options.computedFieldFormat = 'c0';

      valueRenderer.facetValue.computedField = 9999;
      expect(valueRenderer.build().computedField).toBeDefined();
      expect($$(valueRenderer.build().computedField).text()).toBe('$9,999');
    })

    it('should allow to remove element from the dom post build', function () {
      valueRenderer = new ValueElementRenderer(facet, FacetValue.createFromFieldValue(FakeResults.createFakeFieldValue('foo', 1)));
      var count = valueRenderer.build().valueCount;
      expect(count.parentNode).toBeDefined();
      valueRenderer.build().withNo(count);
      expect(count.parentNode).toBeNull();
    })
  })
}