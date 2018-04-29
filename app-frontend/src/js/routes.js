(function () {
    'use strict';

    angular.module("RDash")
        .constant("pageDefinitions", [
            {
                name: 'Dashboard',
                url: '/',
                templateUrl: 'templates/dashboard.html',
                controller: 'DashboardController',
                icon: 'desktop'
            },
            {
                name: 'Apps',
                url: '/apps',
                templateUrl: 'templates/apps.html',
                controller: 'AppDefinitionCtrl',
                icon: 'code'
            },
            {
                name: 'Monitoring',
                url: '/monitoring',
                templateUrl: 'templates/monitoring.html',
                controller: 'MonitoringCtrl',
                icon: 'tachometer'
            },
            {
                name: 'App details',
                url: '/apps/:appName',
                templateUrl: 'templates/app-details.html',
                controller: 'AppDetailsCtrl',
            },
            {
                name: 'Nodes',
                url: '/nodes',
                templateUrl: 'templates/nodes.html',
                controller: 'NodesInfoCtrl',
                icon: 'server'
            },
            {
                name: 'Settings',
                url: '/settings',
                templateUrl: 'templates/settings.html',
                controller: 'SettingsCtrl',
                icon: 'cogs'
            },
            {
                name: 'One-Click Apps',
                url: '/oneclickapps',
                templateUrl: 'templates/oneclick-apps.html',
                controller: 'OneClickAppsCtrl'
            },
            {
                name: 'Login',
                url: '/login',
                templateUrl: 'templates/login.html',
                controller: 'LoginCtrl',
                isFullPage: true
            }
        ]);

    /**
     * Route configuration for the RDash module.
     */
    angular.module('RDash').config(['$stateProvider', '$urlRouterProvider', 'pageDefinitions',
        function ($stateProvider, $urlRouterProvider, pageDefinitions) {

            // For unmatched routes
            $urlRouterProvider.otherwise('/');

            for (var count = 0; count < pageDefinitions.length; count++) {
                var pageDef = pageDefinitions[count];
                $stateProvider
                    .state(pageDef.name, {
                        url: pageDef.url,
                        templateUrl: pageDef.templateUrl,
                        controller: pageDef.controller
                    });
            }

        }
    ]);

})();
