/**
 * The QA switch: on in dev builds, and in a production build opened with ?qa. It gates every QA hook on window
 * (__story, __nuqta, __glStats, __bench, __sound) and the ?hold=1 / ?bang=1 hooks; scripts/*.mjs use those names.
 * Read it at setup, never per frame (it reads location.search).
 */
export const isQA = () => process.env.NODE_ENV !== "production" || /[?&]qa\b/.test(location.search);
