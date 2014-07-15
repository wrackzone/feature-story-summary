var app = null;
var portfolioLevel = 1;

Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
   
    config: {

        defaultSettings : {
            // query : "(State.Name = Developing)"
            queryValue : ""
        }

    },

    getSettingsFields: function() {

        return [
            {
                name: 'queryValue',
                xtype: 'rallytextfield',
                label : 'query expression' // to filter initiatives eg. (State.Name = Developing)'
            }
        ];

    },

    launch: function() {

        app = this;

        app.query = app.getSetting("queryValue");
        console.log("query",app.query);

		async.map( app.createPortfolioTypeConfig(), app.wsapiQuery, function(err,results) {
			app.itemType = _.flatten(results)[0].get("TypePath");
			console.log( "Showing items of type:" + app.itemType );
        	app.addFeatureGrid();
    	});

    },

    createPortfolioTypeConfig : function() {

    	var configs = [
            {   
            	model : "TypeDefinition",
                fetch : true,
                filters : [ { property:"Ordinal", operator:"=", value: portfolioLevel } ]
            }
        ];
        return configs;

    },

    storyColumn : {  

        text: "Architecture", width:150, 
        renderer : function(value, metaData, record, rowIdx, colIdx, store, view) {
            var stories = record.get("Stories");

            var architectureStory = _.find(stories,function(s) { 
            	// return s.get("Name") == "Architecture Story";
                return s.get("Name").indexOf("Architecture Document")!==-1;
            });

            if (!_.isUndefined(architectureStory) && !_.isNull(architectureStory)) {
                console.log("arch story",architectureStory);
                var ref = "/" + 
                          _.last(architectureStory.get("_TypeHierarchy")) + 
                          "/" + 
                          architectureStory.get("ObjectID");
                          
                console.log(ref);
                var link = (Rally.nav.Manager.getDetailUrl({_ref:ref}));
                var tpl = Ext.create('Ext.Template', 
                    "<a href='{ref}' target='_blank'>{content}</a>", 
                    { compiled : true } 
                );
                return tpl.apply({ref:link,content:architectureStory.get("FormattedID") + " - " + architectureStory.get("ScheduleState")});

            	// return architectureStory.get("FormattedID") + " - " + architectureStory.get("ScheduleState");
            } else {
            	return "";
            }
        }

    },
    
    addFeatureGrid : function() {
        var viewport = Ext.create('Ext.Viewport');

        var filter = app.query != "" ?
            Rally.data.wsapi.Filter.fromQueryString(app.query) :
            null;

        console.log("filter",filter);

        Rally.data.ModelFactory.getModel({
         // type: 'PortfolioItem/Feature',
         type : app.itemType,
         success: function(userStoryModel) {
             viewport.add({
                xtype: 'rallygrid',
                model: userStoryModel,
                storeConfig: {
                    pageSize: 25,
                    remoteFilter: true,
                    remoteSort: true,
                    filters : filter !== null ? [filter] : []
                },
                 listeners : {
                    load : function(items) {
                        console.log("load",items.data.items);
                        var features = items.data.items;
                        async.map(features,app.getSnapshots, function(err,results) {
                            _.each( features, function(feature,i){
                                feature.set("Stories",results[i]);
                            })
                        });
                    }
                 },
                 columnCfgs: [
                     'FormattedID',
                     'Name',
                     'c_LocalizationFlg',
                     'Owner',
                     'State',
                     app.storyColumn
                 ]
             });
         }
        });
    },

    // generic function to perform a web services query    
    wsapiQuery : function( config , callback ) {
    	console.log("config",config);
        Ext.create('Rally.data.WsapiDataStore', {
            autoLoad : true,
            limit : "Infinity",
            model : config.model,
            fetch : config.fetch,
            filters : config.filters,
            listeners : {
                scope : this,
                load : function(store, data) {
                    callback(null,data);
                }
            }
        });
    },


    getSnapshots : function(record, callback) {

        var that = this;
        var fetch = ['ObjectID','FormattedID','Name','ScheduleState','_ItemHierarchy','_TypeHierarchy'];
        // var fetch = true;
        var hydrate = ['_TypeHierarchy','ScheduleState'];
        
        var find = {
                '_TypeHierarchy' : { "$in" : ["HierarchicalRequirement"]},
                '_ProjectHierarchy' : { "$in": [app.getContext().getProject().ObjectID] },
                '__At' : 'current',
                "_ItemHierarchy" : { "$in" : [record.get("ObjectID")]  }
        };

        var storeConfig = {
            find : find,
            autoLoad : true,
            pageSize:1000,
            limit: 'Infinity',
            fetch: fetch,
            hydrate: hydrate,
            listeners : {
                scope : this,
                load: function(store, snapshots, success) {
                    callback(null,snapshots);
                }
            }
        };

        var snapshotStore = Ext.create('Rally.data.lookback.SnapshotStore', storeConfig);
    }
});
