function hashCode(s) {
  if (!s) return 0;
  let h = 0;
  let l = s.length;
  let i = 0;
  if (l > 0) {
    while (i < l) {
      h = (h << 5) - h + s.charCodeAt(i++) | 0;
    }
  }
  return h;
}
function patchDefaultLoader(DefaultLoader) {
  // fix issue where the map function was using `System.map[id] = source`
  // https://github.com/aurelia/loader-default/blob/1.0.0/src/index.js#L222
  DefaultLoader.prototype.map = function (id, source) {
    // System.map[id] = source;               // <--- original
    System.config({ map: { [id]: source } }); // <--- fix
  };
}
function buildDependencyMap() {
  return new Promise((resolve, reject) => {
    // read the package.json file
    return axios.get('package.json').then(response => {
      const {status, data} = response;
      // Compute a hash of the loaded package.json file
      const hash = hashCode(JSON.stringify(data.dependencies));
      // Next, compare the hash of the file with the hash stored
      const packageHash = localStorage.getItem('packageHash');
      if (packageHash && +packageHash === hash) {
        // Grab the existing stored map
        const packageMap = JSON.parse(localStorage.getItem('packageMap'));
        const packagePackages = JSON.parse(localStorage.getItem('packagePackages'));
        const packageMeta = JSON.parse(localStorage.getItem('packageMeta'));
        return resolve({map: packageMap, packages: packagePackages, meta: packageMeta});
      } 
      // Store the has of the package.json fiile
      localStorage.setItem('packageHash', hashCode(JSON.stringify(data.dependencies)));
      // We are interested in the dependencies section.
      const uris = [];
      for (const [key, value] of Object.entries(data.dependencies)) {
        console.log(`${key} ${value}`);
        // Load package.json e.g. https://unpkg.com/lodash@4.17.4/package.json
        // Load manifest /?json e.g. https://unpkg.com/lodash@4.17.4/?json
        const pkgUri = `https://unpkg.com/${key}@${value}/package.json`;
        uris.push(axios.get(pkgUri));
        const jsonUri = `https://unpkg.com/${key}@${value}/?json`;
        uris.push(axios.get(jsonUri));
      }
      return Promise.all(uris).then(values => {
        const map = {};
        const packages = {};
        const meta = {};
        for (let i = 0; i < values.length - 1; i += 2) {
          const pkg = values[i];
          const dir = values[i + 1];
          let {browser, main, name, version, jspm} = pkg.data;
          if (jspm && jspm.directories) {
            const jspmMain = jspm.main;
            const dist = jspm.directories.dist || jspm.directories.lib;
            main = `${dist}`;
            packages[name] = {
              main: `${jspmMain}.js`,
              defaultExtension: 'js'
            };
            if (jspm.dependencies) {
              meta[name] = {
                deps: Object.keys(jspm.dependencies)
              };
            }
          } else {
            const minName = `${name}.min.js`;
            const file = dir.data.files.find(f => f.path === `/${minName}`);
            const minDir = dir.data.files.find(f => f.path === '/min');
            if (file) {
              main = minName;
            } else if (minDir) {
              const minName2 = `min/${name}.min.js`;
              const file2 = minDir.files.find(f => f.path === `/${minName2}`);
              if (file2) {
                main = minName2;
              }
            } else if (browser) {
              main = browser;
            }
          }
          if (!main) {
            main = 'index.js';
          }
          // Now load the main entry e.g. https://unpkg.com/lodash@4.17.4/lodash.js
          const valueUri = `npm:${name}@${version}/${main}`;
          map[name] = valueUri;
        }
        // Also, handle fecDependencies
        for (const [key2, value2] of Object.entries(data.fecDependencies)) {
          console.log(`${key2} ${value2}`);
          map[key2] = value2;
        }
        localStorage.setItem('packageMap', JSON.stringify(map));
        localStorage.setItem('packagePackages', JSON.stringify(packages));
        localStorage.setItem('packageMeta', JSON.stringify(meta));
        return resolve({map, packages, meta});
      });
    });
  });
}
//
// The following functions are used for managing the Cache while
// developing the app in dev mode.
//
function postMessageSetup() {
  window.addEventListener('message', receiveMessage, false);
}
async function receiveMessage(event) {
  // console.log('messaged received: ', event);
  // Do we trust the sender of this message?
  const origins = [
    'http://localhost:9000',
    'https://frontendcreator.com'
  ];
  if (!origins.includes(event.origin)) return;

  const messages = JSON.parse(event.data);
  if (messages.length === 0) return;

  let project = '';
  for (const msg of messages) {
    const {operation, repo, key, value, origin} = msg;
    project = repo;
    // Only process messages for the correct repository.
    if (location.href.includes(repo)) {
      // console.debug('repo', repo, 'location.href', location.href);
      switch (operation) {
        case 'set':
          await this.putCache(key, value, origin, repo);
          break;
      }
    }
  }
  //
  // Until we have a working hot module reload capability in the
  // browser, we always redirect to the root of the site.
  //
  setTimeout(() => {
    location.href = `${origin}/${project}/`;
    // location.reload();
  }, 50);
}
function deleteCache(key, origin, repo) {
  const CACHE_NAME = 'runtime';
  return caches.open(CACHE_NAME).then(cache => {
    const req = new Request(`${origin}/${key}`);
    console.log('removing old cache for ', req);
    return cache.delete(req).then((response) => {
      console.log('deleteCache - completed!', response);
    });
  });
}
function putCache(key, value, origin, repo) {
  const CACHE_NAME = 'runtime';
  return caches.open(CACHE_NAME).then(cache => {
    const req = new Request(`${origin}/${key}`);
    const res = new Response(value);
    console.log(`caching (${key}): ${value}`);
    // Put a copy of the response in the runtime cache.
    return cache.put(req, res).then(() => {
      // Completed caching.
      console.log('putCache - completed!');
    });
  });
}

// Execute the script
postMessageSetup();
buildDependencyMap().then(response => {
  const {map, packages, meta} = response;
  console.log(map);
  console.log(packages);
  console.log(meta);
  System.config({
    meta,
    map,
    packages
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker-dev.js');
  }

  System.import('aurelia-loader-default')
    .then(({ DefaultLoader }) => patchDefaultLoader(DefaultLoader))
    .then(() => System.import('aurelia-bootstrapper'));
});
