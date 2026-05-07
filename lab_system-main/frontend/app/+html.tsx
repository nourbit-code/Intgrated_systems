import { ScrollViewStyleReset } from 'expo-router/html';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* 
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native. 
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        {/* Using raw CSS styles as an escape-hatch to ensure the background color never flickers in dark-mode. */}
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        {/* Add any additional <head> elements that you want globally available on web... */}
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveBackground = `
body {
  background-color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
}
@media (prefers-color-scheme: dark) {
  body {
    background-color: #000;
  }
}

.clinic-date-input {
  width: 100%;
  box-sizing: border-box;
  display: block;
  border: 1px solid #E6EAF0;
  border-radius: 16px;
  padding: 12px 16px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  font-size: 15px;
  color: #0F172A;
  background-color: #FBFCFE;
}

.react-datepicker-wrapper {
  width: 100%;
}

.react-datepicker-popper {
  z-index: 9999 !important;
}

#react-datepicker-portal {
  position: relative;
  z-index: 9999;
}

.react-datepicker {
  border: 1px solid #E6EAF0;
  border-radius: 16px;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
}

.react-datepicker__header {
  background-color: #F4F6FB;
  border-bottom: 1px solid #E6EAF0;
}

.react-datepicker__day--selected,
.react-datepicker__day--keyboard-selected {
  background-color: #0B6E4F;
  color: #fff;
}

.react-datepicker__day:hover {
  background-color: #E0F5F0;
}
`;
