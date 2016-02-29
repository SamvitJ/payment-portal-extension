describe('Requestly Background Service', function() {
  var redirectRule,
    cancelRule,
    replaceRule,
    headersRule;

  var URL_SOURCES = {
    GOOGLE: 'http://www.google.com',
    GOOGLE_WITH_SLASH: 'http://www.google.com/',
    YAHOO: 'http://www.yahoo.com',
    FACEBOOK: 'http://www.facebook.com',
    GOOGLE_SEARCH_QUERY: 'https://www.google.co.in/search?q=',
    REQUESTLY: 'http://www.requestly.in',
    DROPBOX: 'http://www.dropbox.com'
  };

  var KEYWORDS = {
    GOOGLE: 'google',
    FACEBOOK: 'facebook'
  };

  afterEach(function() {
    redirectRule = null;
    cancelRule = null;
    replaceRule = null;
  });

  describe('Match Request Url method', function() {
    beforeEach(function() {
      redirectRule = new RedirectRuleModel({
        name: 'Redirect Test Rule',
        pairs: [
          {
            source: {
              key: RQ.RULE_KEYS.URL,
              operator: RQ.RULE_OPERATORS.EQUALS,
              value: URL_SOURCES.GOOGLE
            },
            destination: URL_SOURCES.YAHOO
          }
        ]
      });

      cancelRule = new CancelRuleModel({
        name: 'Cancel Rule',
        pairs: [{
          source: {
            key: RQ.RULE_KEYS.URL,
            operator: RQ.RULE_OPERATORS.CONTAINS,
            value: KEYWORDS.FACEBOOK
          }
        },
        {
          source: {
            key: RQ.RULE_KEYS.URL,
            operator: RQ.RULE_OPERATORS.EQUALS,
            value: URL_SOURCES.FACEBOOK
          }
        }]
      });
    });

    afterEach(function() {
      redirectRule = null;
      cancelRule = null;
    });

    it('should match Redirect Rule Source', function() {
      var pair = redirectRule.getPairs()[0];

      // Equals Operator
      pair['destination'] = URL_SOURCES.YAHOO;
      expect(BG.Methods.matchUrlWithRuleSource(pair.source, pair.destination, URL_SOURCES.GOOGLE))
        .toBe(URL_SOURCES.YAHOO);

      pair['destination'] = URL_SOURCES.FACEBOOK;
      expect(BG.Methods.matchUrlWithRuleSource(pair.source, pair.destination, URL_SOURCES.GOOGLE))
        .toBe(URL_SOURCES.FACEBOOK);

      // Contains Operator
      pair['source']['operator'] = RQ.RULE_OPERATORS.CONTAINS;
      pair['source']['value'] = KEYWORDS.GOOGLE;
      expect(BG.Methods.matchUrlWithRuleSource(pair.source, pair.destination, URL_SOURCES.GOOGLE))
        .toBe(pair['destination']);

      // Matches Operator
      pair['source']['operator'] = RQ.RULE_OPERATORS.MATCHES;
      pair['source']['value'] = '/TGT-([0-9]+)/gi';
      pair['destination'] = URL_SOURCES.REQUESTLY + '?query=TGT-$1';

      expect(BG.Methods.matchUrlWithRuleSource(pair.source, pair.destination,
        URL_SOURCES.GOOGLE_SEARCH_QUERY + 'TGT-491')).toBe(URL_SOURCES.REQUESTLY + '?query=TGT-491');

      expect(BG.Methods.matchUrlWithRuleSource(pair.source, pair.destination,
        URL_SOURCES.GOOGLE_SEARCH_QUERY + 'TGT-10419')).toBe(URL_SOURCES.REQUESTLY + '?query=TGT-10419');
    });

    it('should match Urls ending with slash for equals operator', function() {
      var pair = redirectRule.getPairs()[0];

      expect(BG.Methods.matchUrlWithRuleSource(pair.source, pair.destination, URL_SOURCES.GOOGLE_WITH_SLASH))
        .toBe(URL_SOURCES.YAHOO);
    });

    it('should return null when Cancel Rule Source does not match with Url', function() {
      var pairs = cancelRule.getPairs();

      expect(BG.Methods.matchUrlWithRuleSource(pairs[0].source, null, URL_SOURCES.GOOGLE)).toBeNull();
      expect(BG.Methods.matchUrlWithRuleSource(pairs[1].source, null, URL_SOURCES.FACEBOOK)).not.toBeNull();
    });

    it('should not match url with black list domains', function() {
      var pairs = redirectRule.getPairs();
      
      pairs[0]['source']['operator'] = RQ.RULE_OPERATORS.CONTAINS;
      pairs[0]['source']['value'] = 'requestly';

      expect(BG.Methods.matchUrlWithRuleSource(pairs[0].source, null, 'http://blog.requestly.in')).toBeNull();
      expect(BG.Methods.matchUrlWithRuleSource(pairs[0].source, null, 'http://web.requestly.in')).toBeNull();
      expect(BG.Methods.matchUrlWithRuleSource(
        pairs[0].source, URL_SOURCES.GOOGLE, 'http://quora.com?search=requestly')
      ).toBe(URL_SOURCES.GOOGLE);
    });
  });

  describe('#modifyHeaders', function() {
    beforeEach(function() {
      headersRule = new HeadersRuleModel();

      var pair = headersRule.getPairs()[0];
      pair['header'] = 'User-Agent';
      pair['value'] = 'Mozilla/5.0';
      headersRule.setPair(0, pair);
    });

    afterEach(function() {
      headersRule = null;
      StorageService.records = [];
    });

    it('should return null when no header is modified', function() {
      StorageService.records.push(headersRule.toJSON());

      // Different Headers Target (Rule contains Request Headers)
      expect(BG.Methods.modifyHeaders([], RQ.HEADERS_TARGET.RESPONSE, { url: URL_SOURCES.FACEBOOK })).toBeNull();
    });

    it('should return null when there are no Active Rules', function() {
      headersRule.setStatus(RQ.RULE_STATUS.INACTIVE);

      StorageService.records.push(headersRule.toJSON());
      expect(BG.Methods.modifyHeaders([], RQ.HEADERS_TARGET.REQUEST, { url: URL_SOURCES.FACEBOOK })).toBeNull();
    });

    it('should return modified Headers Array when header is added', function() {
      StorageService.records.push(headersRule.toJSON());

      var modifiedheaders = BG.Methods.modifyHeaders([], RQ.HEADERS_TARGET.REQUEST, { url: URL_SOURCES.FACEBOOK });
      expect(modifiedheaders.length).toEqual(1);
    });

    it('should return modified Headers Array when header is removed', function() {
      var originalHeaders = [
        { name: 'Accept-Language', value: 'en-us'},
        { name: 'Host', value: 'example.com'},
        { name: 'User-Agent', value: 'Chrome'}
      ];

      var pair = headersRule.getPairs()[0];
      pair['type'] = RQ.MODIFICATION_TYPES.REMOVE;
      headersRule.setPair(0, pair);

      StorageService.records.push(headersRule.toJSON());
      var modifiedHeaders = BG.Methods.modifyHeaders(originalHeaders, RQ.HEADERS_TARGET.REQUEST, { url: URL_SOURCES.FACEBOOK });
      expect(modifiedHeaders.length).toEqual(2);
    });
  });

  describe('#BG.Methods.matchUrlWithReplaceRulePairs', function() {
    beforeEach(function() {
      replaceRule = new ReplaceRuleModel({
        name: 'Replace Test Rule',
        pairs: [
          { from: '?dl=0', to: '?dl=1' },
          { from: '/dropbox/ig', to: 'facebook'}
        ]
      }).toJSON();
    });

    it('should replace query paramters with ? in beginning (Issue-86)', function() {
      expect(BG.Methods.matchUrlWithReplaceRulePairs(replaceRule, URL_SOURCES.DROPBOX + '?dl=0'))
        .toBe(URL_SOURCES.DROPBOX + '?dl=1');
    });

    it('should replace when "pair.from" is valid regex', function() {
      expect(BG.Methods.matchUrlWithReplaceRulePairs(replaceRule, URL_SOURCES.DROPBOX))
        .toBe(URL_SOURCES.FACEBOOK);
    });

    afterEach(function() {
      replaceRule = null;
    });
  });
});