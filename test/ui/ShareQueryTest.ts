/// <reference path="../Test.ts" />

module Coveo {
  describe('ShareQuery', function () {
    var test: Mock.IBasicComponentSetup<ShareQuery>;
    
    beforeEach(function () {
      test = Mock.basicComponentSetup<ShareQuery>(ShareQuery);
    })
    
    it('should render properly', function () {
      expect($(test.cmp.element).find('.coveo-share-query-summary-info .coveo-query-summary-info-title')).not.toBeNull();
      expect($(test.cmp.element).find('.coveo-share-query-summary-info .coveo-share-query-summary-info-close')).not.toBeNull();
      expect($(test.cmp.element).find('.coveo-share-query-summary-info .coveo-share-query-summary-info-boxes')).not.toBeNull();
      expect($(test.cmp.element).find('.coveo-share-query-summary-info .coveo-share-query-summary-info-boxes input')).not.toBeNull();
    })
    
    it('should update according to result', function () {
      Simulate.query(test.env, <SimulateQueryData>{
        results: <IQueryResults>{
          totalCount: 5
        },
        query: <IQuery>{
          firstResult: 0,
          q: 'query',
          aq: 'advanced query',
          cq: 'constant query'
        }
      });
      
      expect(test.cmp.getCompleteQuery()).toBe('(query) (advanced query) (constant query)');
    })
    
    it('should add the proper CSS class when opened', function () {
      test.cmp.open();
      expect($$(test.cmp.element).hasClass('coveo-share-query-opened')).toBe(true);
    })
    
    it('should remove the CSS class when closed', function () {
      test.cmp.close();
      expect($$(test.cmp.element).hasClass('coveo-share-query-opened')).toBe(false);
    })
  })
}