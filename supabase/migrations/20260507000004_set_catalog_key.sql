-- Set the import admin key so trigger_catalog_refresh() can authenticate
-- its HTTP call to the catalog-scheduler edge function.
select watch_yourself.set_catalog_key('aec106b9b6e5fe0233f68acbb22e1c6be71a982b6d6add4e');
