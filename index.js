const puppeteer = require("puppeteer");

const foundEmails = [];

const urls = ["https://www.outagebuddy.com"];
const searchedUrls = {};
const currentPageNestedUrls = [];

const maxDepth = 3;

const run = async () => {
  const browser = await puppeteer.launch();

  const page = await browser.newPage();

  while (urls.length || currentPageNestedUrls.length) {
    // We shift the nested urls because we need to look at them in the order
    // they were added, so that the depth goes in order. Otherwise, we might
    // cache the page as viewed at the max depth, but we were really supposed to
    // look at it in an earlier depth too, and find nested links.
    const next = currentPageNestedUrls.shift() || urls.pop();

    // Assume `next` is a string
    let nextUrl = next;

    // Set the default current depth
    let currentDepth = 1;

    // If `next` is an array, the first element will be the url, and the second
    // will be the depth at which the url was found originally.
    if (Array.isArray(next)) {
      nextUrl = next[0];

      // current depth is the depth where url was found + 1
      currentDepth = next[1] + 1;
    }

    // Optimization to help with searching pages twice
    if (searchedUrls[nextUrl]) {
      // we have already searched this page, don't do it again
      continue;
    }

    try {
      // Cache the url so we don't search it again in the future
      searchedUrls[nextUrl] = true;

      // Navigate to the page and accept DOMContentLoaded instead of a load
      // event.
      await page.goto(nextUrl, {
        waitUntil: "domcontentloaded",
      });

      // Get all the links on the page
      const links = await page.$$("a");

      for (var i = 0; i < links.length; i++) {
        // Get the value of the href property from the link
        const href = await (await links[i].getProperty("href")).jsonValue();

        if (/mailto/gi.test(href)) {
          // The link is a mailto: link, so save it as an email found
          foundEmails.push([nextUrl, href.replace(/mailto:/gi, "")]);

          // We don't want to count the link as a searchable page
          continue;
        }

        // Check if we should search the found page for more links
        if (currentDepth < maxDepth) {
          // We are not at the max depth, add it to the list to be searched
          currentPageNestedUrls.push([href, currentDepth]);
        }
      }

      // Get the whole page text
      const body = await page.evaluate(() => document.body.innerText);

      // Find any emails on the page
      (body.match(/\S+@\S+/g) || []).forEach((email) => {
        // Push the email to the emails array
        foundEmails.push([nextUrl, email.replace(/^\.|\.$/, "")]);
      });
    } catch (err) {
      // Spit out the error, but continue
      console.log(`The following error occurred while searching ${nextUrl}:`);
      console.error(err);
    }
  }

  await browser.close();
};

run()
  .then(() => {
    console.log(foundEmails);
  })
  .catch((err) => console.error(err));
