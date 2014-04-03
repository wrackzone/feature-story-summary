var app = null;

Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    items:{},
    launch: function() {
        app = this;

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
                filters : [ { property:"Ordinal", operator:"=", value:2} ]
            }
        ];
        return configs;
    },

     storyColumn : {  
        text: "Architecture", width:150, 
        renderer : function(value, metaData, record, rowIdx, colIdx, store, view) {
            var stories = record.get("Stories");

            var architectureStory = _.find(stories,function(s) { 
            	return s.get("Name") == "Architecture Story";
            });

            if (!_.isUndefined(architectureStory) && !_.isNull(architectureStory)) {
            	return architectureStory.get("FormattedID") + " - " + architectureStory.get("ScheduleState");
            } else {
            	return "";
            }
        }
//             if (defects && defects.length > 0) {
//                 var states = _.countBy(defects, function(d) { 
//                     return d.get("State")!= "Closed" ? "Open" : "Closed";
//                 });
//                 states.Open = states.Open !== undefined ? states.Open : 0;
// //                    states.Open = 0 
//                 states.length = defects.length;
//                 var tpl = Ext.create('Ext.Template', "{Open}/{length}", { compiled : true } );
//                 return tpl.apply(states);
//             } else
//                 return "";
        // }
    },
    
    addFeatureGrid : function() {
        var viewport = Ext.create('Ext.Viewport');
        Rally.data.ModelFactory.getModel({
         // type: 'PortfolioItem/Feature',
         type : app.itemType,
         success: function(userStoryModel) {
             viewport.add({
                 xtype: 'rallygrid',
                 model: userStoryModel,
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
                     'Owner',
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
                	console.log("config",config,data);
                    callback(null,data);
                }
            }
        });
    },


    getSnapshots : function(record, callback) {

        var that = this;
        var fetch = ['ObjectID','FormattedID','Name','ScheduleState','_ItemHierarchy','_TypeHierarchy'];
        var hydrate = ['_TypeHierarchy','ScheduleState'];
        
        var find = {
                '_TypeHierarchy' : { "$in" : ["HierarchicalRequirement"]},
                '_ProjectHierarchy' : { "$in": app.getContext().getProject().ObjectID },
                '__At' : 'current',
                "_ItemHierarchy" : { "$in" : record.get("ObjectID")  }
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