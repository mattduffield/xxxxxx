import {PLATFORM} from 'aurelia-pal';

export class App {
  configureRouter(config, router) {
    config.title = 'Aurelia Babel SystemJS';
    config.map([
      {"route": ["", "welcome"], "name": "welcome", "moduleId": PLATFORM.moduleName("./welcome"), "nav": true, "title": "Welcome"},
      {"route": "users", "name": "users", "moduleId": PLATFORM.moduleName("./users"), "nav": true, "title": "GitHub Users"},
      {"route": "child-router", "name": "child-router", "moduleId": PLATFORM.moduleName("./child-router"), "nav": true, "title": "Child Router"},
      {"route": "combo-box", "name": "combo-box", "moduleId": PLATFORM.moduleName("./views/combo-box/combo-box"), "nav": true, "title": "ComboBox"},
      {"route": "grid", "name": "grid", "moduleId": PLATFORM.moduleName("./views/grid/grid"), "nav": true, "title": "Grid"}
    ]);

    this.router = router;
  }
}
