/**
 * Windows'da release build C++ papkasi (.cxx/RelWithDebInfo/...) 260 belgidan oshib ketadi va
 * ninja "mkdir ... No such file or directory" bilan yiqiladi. Faqat Windows'da CMake build
 * papkasini qisqa joyga (C:/nbx) ko'chiramiz. Linux/macOS va EAS build'ga ta'sir qilmaydi.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const MARK = '// niyat: short-cxx-path';
const SNIPPET = `
    ${MARK}
    if (System.getProperty("os.name").toLowerCase().contains("windows")) {
        externalNativeBuild { cmake { buildStagingDirectory = file("C:/nbx") } }
    }
`;

module.exports = function withShortNativeBuildPath(config) {
  return withAppBuildGradle(config, (cfg) => {
    const src = cfg.modResults.contents;
    if (!src.includes(MARK)) {
      cfg.modResults.contents = src.replace(/^android\s*\{\s*$/m, (m) => m + SNIPPET);
    }
    return cfg;
  });
};
