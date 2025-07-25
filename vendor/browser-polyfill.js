/*
 * Copyright (c) 2016-2019, 2021-2022  Mozilla Foundation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use strict";

if (
  typeof globalThis.browser === "undefined" &&
  typeof globalThis.chrome !== "undefined"
) {
  // Em Manifest V3, o script de fundo é um Service Worker (módulo ES),
  // onde `var` no escopo superior não cria uma variável global.
  // Precisamos de anexar explicitamente ao objeto global (`self` no worker, `window` na UI).
  // `globalThis` é a forma padrão e universal de aceder ao escopo global.
  globalThis.browser = globalThis.chrome;
}
