/**
 * Tree-shaken local Lucide SVG icon registry (ISC License — lucide-react v0.546.0).
 * Contains only the icons actively referenced by this application, preserving exact
 * SVG paths, props, ref forwarding, and `lucide lucide-*` CSS classes.
 */
import React, { forwardRef, createElement } from "react";

export type IconNode = ReadonlyArray<readonly [string, Record<string, string | number>]>;

export interface LucideProps extends React.SVGProps<SVGSVGElement> {
  size?: string | number;
  color?: string;
  strokeWidth?: string | number;
  absoluteStrokeWidth?: boolean;
}

export type LucideIcon = React.ForwardRefExoticComponent<
  Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>
>;

const toKebabCase = (str: string): string =>
  str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

const toPascalCase = (str: string): string =>
  str
    .split(/[-_]+/)
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join("");

const mergeClasses = (...classes: Array<string | undefined>): string =>
  Array.from(new Set(classes.filter(Boolean).join(" ").trim().split(/\s+/))).join(" ");

const hasA11yProp = (props: Record<string, unknown>): boolean => {
  for (const key in props) {
    if (key.startsWith("aria-") || key === "role" || key === "title") return true;
  }
  return false;
};

function createLucideIcon(iconName: string, iconNode: IconNode): LucideIcon {
  const Component = forwardRef<SVGSVGElement, LucideProps>(
    (
      {
        color = "currentColor",
        size = 24,
        strokeWidth = 2,
        absoluteStrokeWidth,
        className = "",
        children,
        ...rest
      },
      ref
    ) =>
      createElement(
        "svg",
        {
          ref,
          xmlns: "http://www.w3.org/2000/svg",
          width: size,
          height: size,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: color,
          strokeWidth: absoluteStrokeWidth
            ? (Number(strokeWidth) * 24) / Number(size)
            : strokeWidth,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          className: mergeClasses(
            "lucide",
            `lucide-${toKebabCase(toPascalCase(iconName))}`,
            `lucide-${iconName}`,
            className
          ),
          ...(!children && !hasA11yProp(rest as Record<string, unknown>)
            ? { "aria-hidden": "true" }
            : {}),
          ...rest,
        },
        [
          ...iconNode.map(([tag, attrs]) => createElement(tag, attrs)),
          ...(Array.isArray(children) ? children : children ? [children] : []),
        ]
      )
  );
  Component.displayName = toPascalCase(iconName);
  return Component;
}

export const Activity = createLucideIcon("activity", [["path",{"d":"M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2","key":"169zse"}]]);
export const AlertCircle = createLucideIcon("circle-alert", [["circle",{"cx":"12","cy":"12","r":"10","key":"1mglay"}],["line",{"x1":"12","x2":"12","y1":"8","y2":"12","key":"1pkeuh"}],["line",{"x1":"12","x2":"12.01","y1":"16","y2":"16","key":"4dfq90"}]]);
export const AlertTriangle = createLucideIcon("triangle-alert", [["path",{"d":"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3","key":"wmoenq"}],["path",{"d":"M12 9v4","key":"juzpu7"}],["path",{"d":"M12 17h.01","key":"p32p05"}]]);
export const AlignLeft = createLucideIcon("text-align-start", [["path",{"d":"M21 5H3","key":"1fi0y6"}],["path",{"d":"M15 12H3","key":"6jk70r"}],["path",{"d":"M17 19H3","key":"z6ezky"}]]);
export const Archive = createLucideIcon("archive", [["rect",{"width":"20","height":"5","x":"2","y":"3","rx":"1","key":"1wp1u1"}],["path",{"d":"M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8","key":"1s80jp"}],["path",{"d":"M10 12h4","key":"a56b0p"}]]);
export const ArrowDown = createLucideIcon("arrow-down", [["path",{"d":"M12 5v14","key":"s699le"}],["path",{"d":"m19 12-7 7-7-7","key":"1idqje"}]]);
export const ArrowDownLeft = createLucideIcon("arrow-down-left", [["path",{"d":"M17 7 7 17","key":"15tmo1"}],["path",{"d":"M17 17H7V7","key":"1org7z"}]]);
export const ArrowDownRight = createLucideIcon("arrow-down-right", [["path",{"d":"m7 7 10 10","key":"1fmybs"}],["path",{"d":"M17 7v10H7","key":"6fjiku"}]]);
export const ArrowDownUp = createLucideIcon("arrow-down-up", [["path",{"d":"m3 16 4 4 4-4","key":"1co6wj"}],["path",{"d":"M7 20V4","key":"1yoxec"}],["path",{"d":"m21 8-4-4-4 4","key":"1c9v7m"}],["path",{"d":"M17 4v16","key":"7dpous"}]]);
export const ArrowLeft = createLucideIcon("arrow-left", [["path",{"d":"m12 19-7-7 7-7","key":"1l729n"}],["path",{"d":"M19 12H5","key":"x3x0zl"}]]);
export const ArrowLeftRight = createLucideIcon("arrow-left-right", [["path",{"d":"M8 3 4 7l4 4","key":"9rb6wj"}],["path",{"d":"M4 7h16","key":"6tx8e3"}],["path",{"d":"m16 21 4-4-4-4","key":"siv7j2"}],["path",{"d":"M20 17H4","key":"h6l3hr"}]]);
export const ArrowRight = createLucideIcon("arrow-right", [["path",{"d":"M5 12h14","key":"1ays0h"}],["path",{"d":"m12 5 7 7-7 7","key":"xquz4c"}]]);
export const ArrowRightLeft = createLucideIcon("arrow-right-left", [["path",{"d":"m16 3 4 4-4 4","key":"1x1c3m"}],["path",{"d":"M20 7H4","key":"zbl0bi"}],["path",{"d":"m8 21-4-4 4-4","key":"h9nckh"}],["path",{"d":"M4 17h16","key":"g4d7ey"}]]);
export const ArrowUp = createLucideIcon("arrow-up", [["path",{"d":"m5 12 7-7 7 7","key":"hav0vg"}],["path",{"d":"M12 19V5","key":"x0mq9r"}]]);
export const ArrowUpDown = createLucideIcon("arrow-up-down", [["path",{"d":"m21 16-4 4-4-4","key":"f6ql7i"}],["path",{"d":"M17 20V4","key":"1ejh1v"}],["path",{"d":"m3 8 4-4 4 4","key":"11wl7u"}],["path",{"d":"M7 4v16","key":"1glfcx"}]]);
export const ArrowUpRight = createLucideIcon("arrow-up-right", [["path",{"d":"M7 7h10v10","key":"1tivn9"}],["path",{"d":"M7 17 17 7","key":"1vkiza"}]]);
export const Award = createLucideIcon("award", [["path",{"d":"m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526","key":"1yiouv"}],["circle",{"cx":"12","cy":"8","r":"6","key":"1vp47v"}]]);
export const Banknote = createLucideIcon("banknote", [["rect",{"width":"20","height":"12","x":"2","y":"6","rx":"2","key":"9lu3g6"}],["circle",{"cx":"12","cy":"12","r":"2","key":"1c9p78"}],["path",{"d":"M6 12h.01M18 12h.01","key":"113zkx"}]]);
export const BarChart3 = createLucideIcon("chart-column", [["path",{"d":"M3 3v16a2 2 0 0 0 2 2h16","key":"c24i48"}],["path",{"d":"M18 17V9","key":"2bz60n"}],["path",{"d":"M13 17V5","key":"1frdt8"}],["path",{"d":"M8 17v-3","key":"17ska0"}]]);
export const Bell = createLucideIcon("bell", [["path",{"d":"M10.268 21a2 2 0 0 0 3.464 0","key":"vwvbt9"}],["path",{"d":"M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326","key":"11g9vi"}]]);
export const BellOff = createLucideIcon("bell-off", [["path",{"d":"M10.268 21a2 2 0 0 0 3.464 0","key":"vwvbt9"}],["path",{"d":"M17 17H4a1 1 0 0 1-.74-1.673C4.59 13.956 6 12.499 6 8a6 6 0 0 1 .258-1.742","key":"178tsu"}],["path",{"d":"m2 2 20 20","key":"1ooewy"}],["path",{"d":"M8.668 3.01A6 6 0 0 1 18 8c0 2.687.77 4.653 1.707 6.05","key":"1hqiys"}]]);
export const BookOpen = createLucideIcon("book-open", [["path",{"d":"M12 7v14","key":"1akyts"}],["path",{"d":"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z","key":"ruj8y"}]]);
export const Boxes = createLucideIcon("boxes", [["path",{"d":"M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z","key":"lc1i9w"}],["path",{"d":"m7 16.5-4.74-2.85","key":"1o9zyk"}],["path",{"d":"m7 16.5 5-3","key":"va8pkn"}],["path",{"d":"M7 16.5v5.17","key":"jnp8gn"}],["path",{"d":"M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z","key":"8zsnat"}],["path",{"d":"m17 16.5-5-3","key":"8arw3v"}],["path",{"d":"m17 16.5 4.74-2.85","key":"8rfmw"}],["path",{"d":"M17 16.5v5.17","key":"k6z78m"}],["path",{"d":"M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z","key":"1xygjf"}],["path",{"d":"M12 8 7.26 5.15","key":"1vbdud"}],["path",{"d":"m12 8 4.74-2.85","key":"3rx089"}],["path",{"d":"M12 13.5V8","key":"1io7kd"}]]);
export const Building = createLucideIcon("building", [["path",{"d":"M12 10h.01","key":"1nrarc"}],["path",{"d":"M12 14h.01","key":"1etili"}],["path",{"d":"M12 6h.01","key":"1vi96p"}],["path",{"d":"M16 10h.01","key":"1m94wz"}],["path",{"d":"M16 14h.01","key":"1gbofw"}],["path",{"d":"M16 6h.01","key":"1x0f13"}],["path",{"d":"M8 10h.01","key":"19clt8"}],["path",{"d":"M8 14h.01","key":"6423bh"}],["path",{"d":"M8 6h.01","key":"1dz90k"}],["path",{"d":"M9 22v-3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3","key":"cabbwy"}],["rect",{"x":"4","y":"2","width":"16","height":"20","rx":"2","key":"1uxh74"}]]);
export const Building2 = createLucideIcon("building-2", [["path",{"d":"M10 12h4","key":"a56b0p"}],["path",{"d":"M10 8h4","key":"1sr2af"}],["path",{"d":"M14 21v-3a2 2 0 0 0-4 0v3","key":"1rgiei"}],["path",{"d":"M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2","key":"secmi2"}],["path",{"d":"M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16","key":"16ra0t"}]]);
export const Calculator = createLucideIcon("calculator", [["rect",{"width":"16","height":"20","x":"4","y":"2","rx":"2","key":"1nb95v"}],["line",{"x1":"8","x2":"16","y1":"6","y2":"6","key":"x4nwl0"}],["line",{"x1":"16","x2":"16","y1":"14","y2":"18","key":"wjye3r"}],["path",{"d":"M16 10h.01","key":"1m94wz"}],["path",{"d":"M12 10h.01","key":"1nrarc"}],["path",{"d":"M8 10h.01","key":"19clt8"}],["path",{"d":"M12 14h.01","key":"1etili"}],["path",{"d":"M8 14h.01","key":"6423bh"}],["path",{"d":"M12 18h.01","key":"mhygvu"}],["path",{"d":"M8 18h.01","key":"lrp35t"}]]);
export const Calendar = createLucideIcon("calendar", [["path",{"d":"M8 2v4","key":"1cmpym"}],["path",{"d":"M16 2v4","key":"4m81vk"}],["rect",{"width":"18","height":"18","x":"3","y":"4","rx":"2","key":"1hopcy"}],["path",{"d":"M3 10h18","key":"8toen8"}]]);
export const CalendarClock = createLucideIcon("calendar-clock", [["path",{"d":"M16 14v2.2l1.6 1","key":"fo4ql5"}],["path",{"d":"M16 2v4","key":"4m81vk"}],["path",{"d":"M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5","key":"1osxxc"}],["path",{"d":"M3 10h5","key":"r794hk"}],["path",{"d":"M8 2v4","key":"1cmpym"}],["circle",{"cx":"16","cy":"16","r":"6","key":"qoo3c4"}]]);
export const Check = createLucideIcon("check", [["path",{"d":"M20 6 9 17l-5-5","key":"1gmf2c"}]]);
export const CheckCircle = createLucideIcon("circle-check-big", [["path",{"d":"M21.801 10A10 10 0 1 1 17 3.335","key":"yps3ct"}],["path",{"d":"m9 11 3 3L22 4","key":"1pflzl"}]]);
export const CheckCircle2 = createLucideIcon("circle-check", [["circle",{"cx":"12","cy":"12","r":"10","key":"1mglay"}],["path",{"d":"m9 12 2 2 4-4","key":"dzmm74"}]]);
export const CheckSquare = createLucideIcon("square-check-big", [["path",{"d":"M21 10.656V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12.344","key":"2acyp4"}],["path",{"d":"m9 11 3 3L22 4","key":"1pflzl"}]]);
export const ChevronDown = createLucideIcon("chevron-down", [["path",{"d":"m6 9 6 6 6-6","key":"qrunsl"}]]);
export const ChevronLeft = createLucideIcon("chevron-left", [["path",{"d":"m15 18-6-6 6-6","key":"1wnfg3"}]]);
export const ChevronRight = createLucideIcon("chevron-right", [["path",{"d":"m9 18 6-6-6-6","key":"mthhwq"}]]);
export const ChevronUp = createLucideIcon("chevron-up", [["path",{"d":"m18 15-6-6-6 6","key":"153udz"}]]);
export const Clock = createLucideIcon("clock", [["path",{"d":"M12 6v6l4 2","key":"mmk7yg"}],["circle",{"cx":"12","cy":"12","r":"10","key":"1mglay"}]]);
export const CloudOff = createLucideIcon("cloud-off", [["path",{"d":"m2 2 20 20","key":"1ooewy"}],["path",{"d":"M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193","key":"yfwify"}],["path",{"d":"M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07","key":"jlfiyv"}]]);
export const Coins = createLucideIcon("coins", [["circle",{"cx":"8","cy":"8","r":"6","key":"3yglwk"}],["path",{"d":"M18.09 10.37A6 6 0 1 1 10.34 18","key":"t5s6rm"}],["path",{"d":"M7 6h1v4","key":"1obek4"}],["path",{"d":"m16.71 13.88.7.71-2.82 2.82","key":"1rbuyh"}]]);
export const Columns3 = createLucideIcon("columns-3", [["rect",{"width":"18","height":"18","x":"3","y":"3","rx":"2","key":"afitv7"}],["path",{"d":"M9 3v18","key":"fh3hqa"}],["path",{"d":"M15 3v18","key":"14nvp0"}]]);
export const Copy = createLucideIcon("copy", [["rect",{"width":"14","height":"14","x":"8","y":"8","rx":"2","ry":"2","key":"17jyea"}],["path",{"d":"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2","key":"zix9uf"}]]);
export const CreditCard = createLucideIcon("credit-card", [["rect",{"width":"20","height":"14","x":"2","y":"5","rx":"2","key":"ynyp8z"}],["line",{"x1":"2","x2":"22","y1":"10","y2":"10","key":"1b3vmo"}]]);
export const Database = createLucideIcon("database", [["ellipse",{"cx":"12","cy":"5","rx":"9","ry":"3","key":"msslwz"}],["path",{"d":"M3 5V19A9 3 0 0 0 21 19V5","key":"1wlel7"}],["path",{"d":"M3 12A9 3 0 0 0 21 12","key":"mv7ke4"}]]);
export const DollarSign = createLucideIcon("dollar-sign", [["line",{"x1":"12","x2":"12","y1":"2","y2":"22","key":"7eqyqh"}],["path",{"d":"M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6","key":"1b0p4s"}]]);
export const Download = createLucideIcon("download", [["path",{"d":"M12 15V3","key":"m9g1x1"}],["path",{"d":"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4","key":"ih7n3h"}],["path",{"d":"m7 10 5 5 5-5","key":"brsn70"}]]);
export const Edit2 = createLucideIcon("pen", [["path",{"d":"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z","key":"1a8usu"}]]);
export const Edit3 = createLucideIcon("pen-line", [["path",{"d":"M13 21h8","key":"1jsn5i"}],["path",{"d":"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z","key":"1a8usu"}]]);
export const ExternalLink = createLucideIcon("external-link", [["path",{"d":"M15 3h6v6","key":"1q9fwt"}],["path",{"d":"M10 14 21 3","key":"gplh6r"}],["path",{"d":"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6","key":"a6xqqp"}]]);
export const Eye = createLucideIcon("eye", [["path",{"d":"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0","key":"1nclc0"}],["circle",{"cx":"12","cy":"12","r":"3","key":"1v7zrd"}]]);
export const EyeOff = createLucideIcon("eye-off", [["path",{"d":"M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49","key":"ct8e1f"}],["path",{"d":"M14.084 14.158a3 3 0 0 1-4.242-4.242","key":"151rxh"}],["path",{"d":"M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143","key":"13bj9a"}],["path",{"d":"m2 2 20 20","key":"1ooewy"}]]);
export const FileCheck2 = createLucideIcon("file-check-2", [["path",{"d":"M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4","key":"1pf5j1"}],["path",{"d":"M14 2v4a2 2 0 0 0 2 2h4","key":"tnqrlb"}],["path",{"d":"m3 15 2 2 4-4","key":"1lhrkk"}]]);
export const FileDown = createLucideIcon("file-down", [["path",{"d":"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z","key":"1rqfz7"}],["path",{"d":"M14 2v4a2 2 0 0 0 2 2h4","key":"tnqrlb"}],["path",{"d":"M12 18v-6","key":"17g6i2"}],["path",{"d":"m9 15 3 3 3-3","key":"1npd3o"}]]);
export const FileImage = createLucideIcon("file-image", [["path",{"d":"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z","key":"1rqfz7"}],["path",{"d":"M14 2v4a2 2 0 0 0 2 2h4","key":"tnqrlb"}],["circle",{"cx":"10","cy":"12","r":"2","key":"737tya"}],["path",{"d":"m20 17-1.296-1.296a2.41 2.41 0 0 0-3.408 0L9 22","key":"wt3hpn"}]]);
export const FileJson = createLucideIcon("file-json", [["path",{"d":"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z","key":"1rqfz7"}],["path",{"d":"M14 2v4a2 2 0 0 0 2 2h4","key":"tnqrlb"}],["path",{"d":"M10 12a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1","key":"1oajmo"}],["path",{"d":"M14 18a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1 1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1","key":"mpwhp6"}]]);
export const FilePlus = createLucideIcon("file-plus", [["path",{"d":"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z","key":"1rqfz7"}],["path",{"d":"M14 2v4a2 2 0 0 0 2 2h4","key":"tnqrlb"}],["path",{"d":"M9 15h6","key":"cctwl0"}],["path",{"d":"M12 18v-6","key":"17g6i2"}]]);
export const FilePlus2 = createLucideIcon("file-plus-2", [["path",{"d":"M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4","key":"1pf5j1"}],["path",{"d":"M14 2v4a2 2 0 0 0 2 2h4","key":"tnqrlb"}],["path",{"d":"M3 15h6","key":"4e2qda"}],["path",{"d":"M6 12v6","key":"1u72j0"}]]);
export const FileSpreadsheet = createLucideIcon("file-spreadsheet", [["path",{"d":"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z","key":"1rqfz7"}],["path",{"d":"M14 2v4a2 2 0 0 0 2 2h4","key":"tnqrlb"}],["path",{"d":"M8 13h2","key":"yr2amv"}],["path",{"d":"M14 13h2","key":"un5t4a"}],["path",{"d":"M8 17h2","key":"2yhykz"}],["path",{"d":"M14 17h2","key":"10kma7"}]]);
export const FileText = createLucideIcon("file-text", [["path",{"d":"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z","key":"1rqfz7"}],["path",{"d":"M14 2v4a2 2 0 0 0 2 2h4","key":"tnqrlb"}],["path",{"d":"M10 9H8","key":"b1mrlr"}],["path",{"d":"M16 13H8","key":"t4e002"}],["path",{"d":"M16 17H8","key":"z1uh3a"}]]);
export const FileUp = createLucideIcon("file-up", [["path",{"d":"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z","key":"1rqfz7"}],["path",{"d":"M14 2v4a2 2 0 0 0 2 2h4","key":"tnqrlb"}],["path",{"d":"M12 12v6","key":"3ahymv"}],["path",{"d":"m15 15-3-3-3 3","key":"15xj92"}]]);
export const Filter = createLucideIcon("funnel", [["path",{"d":"M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z","key":"sc7q7i"}]]);
export const FolderOpen = createLucideIcon("folder-open", [["path",{"d":"m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2","key":"usdka0"}]]);
export const Globe = createLucideIcon("globe", [["circle",{"cx":"12","cy":"12","r":"10","key":"1mglay"}],["path",{"d":"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20","key":"13o1zl"}],["path",{"d":"M2 12h20","key":"9i4pu4"}]]);
export const GripVertical = createLucideIcon("grip-vertical", [["circle",{"cx":"9","cy":"12","r":"1","key":"1vctgf"}],["circle",{"cx":"9","cy":"5","r":"1","key":"hp0tcf"}],["circle",{"cx":"9","cy":"19","r":"1","key":"fkjjf6"}],["circle",{"cx":"15","cy":"12","r":"1","key":"1tmaij"}],["circle",{"cx":"15","cy":"5","r":"1","key":"19l28e"}],["circle",{"cx":"15","cy":"19","r":"1","key":"f4zoj3"}]]);
export const HardDrive = createLucideIcon("hard-drive", [["line",{"x1":"22","x2":"2","y1":"12","y2":"12","key":"1y58io"}],["path",{"d":"M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z","key":"oot6mr"}],["line",{"x1":"6","x2":"6.01","y1":"16","y2":"16","key":"sgf278"}],["line",{"x1":"10","x2":"10.01","y1":"16","y2":"16","key":"1l4acy"}]]);
export const HeartCrack = createLucideIcon("heart-crack", [["path",{"d":"M12.409 5.824c-.702.792-1.15 1.496-1.415 2.166l2.153 2.156a.5.5 0 0 1 0 .707l-2.293 2.293a.5.5 0 0 0 0 .707L12 15","key":"idzbju"}],["path",{"d":"M13.508 20.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5a5.5 5.5 0 0 1 9.591-3.677.6.6 0 0 0 .818.001A5.5 5.5 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5z","key":"1su70f"}]]);
export const HelpCircle = createLucideIcon("circle-question-mark", [["circle",{"cx":"12","cy":"12","r":"10","key":"1mglay"}],["path",{"d":"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3","key":"1u773s"}],["path",{"d":"M12 17h.01","key":"p32p05"}]]);
export const History = createLucideIcon("history", [["path",{"d":"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8","key":"1357e3"}],["path",{"d":"M3 3v5h5","key":"1xhq8a"}],["path",{"d":"M12 7v5l4 2","key":"1fdv2h"}]]);
export const Image = createLucideIcon("image", [["rect",{"width":"18","height":"18","x":"3","y":"3","rx":"2","ry":"2","key":"1m3agn"}],["circle",{"cx":"9","cy":"9","r":"2","key":"af1f0g"}],["path",{"d":"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21","key":"1xmnt7"}]]);
export const ImageDown = createLucideIcon("image-down", [["path",{"d":"M10.3 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10l-3.1-3.1a2 2 0 0 0-2.814.014L6 21","key":"9csbqa"}],["path",{"d":"m14 19 3 3v-5.5","key":"9ldu5r"}],["path",{"d":"m17 22 3-3","key":"1nkfve"}],["circle",{"cx":"9","cy":"9","r":"2","key":"af1f0g"}]]);
export const Key = createLucideIcon("key", [["path",{"d":"m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4","key":"g0fldk"}],["path",{"d":"m21 2-9.6 9.6","key":"1j0ho8"}],["circle",{"cx":"7.5","cy":"15.5","r":"5.5","key":"yqb3hr"}]]);
export const Keyboard = createLucideIcon("keyboard", [["path",{"d":"M10 8h.01","key":"1r9ogq"}],["path",{"d":"M12 12h.01","key":"1mp3jc"}],["path",{"d":"M14 8h.01","key":"1primd"}],["path",{"d":"M16 12h.01","key":"1l6xoz"}],["path",{"d":"M18 8h.01","key":"emo2bl"}],["path",{"d":"M6 8h.01","key":"x9i8wu"}],["path",{"d":"M7 16h10","key":"wp8him"}],["path",{"d":"M8 12h.01","key":"czm47f"}],["rect",{"width":"20","height":"16","x":"2","y":"4","rx":"2","key":"18n3k1"}]]);
export const KeyRound = createLucideIcon("key-round", [["path",{"d":"M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z","key":"1s6t7t"}],["circle",{"cx":"16.5","cy":"7.5","r":".5","fill":"currentColor","key":"w0ekpg"}]]);
export const Landmark = createLucideIcon("landmark", [["path",{"d":"M10 18v-7","key":"wt116b"}],["path",{"d":"M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z","key":"1m329m"}],["path",{"d":"M14 18v-7","key":"vav6t3"}],["path",{"d":"M18 18v-7","key":"aexdmj"}],["path",{"d":"M3 22h18","key":"8prr45"}],["path",{"d":"M6 18v-7","key":"1ivflk"}]]);
export const Layers = createLucideIcon("layers", [["path",{"d":"M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z","key":"zw3jo"}],["path",{"d":"M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12","key":"1wduqc"}],["path",{"d":"M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17","key":"kqbvx6"}]]);
export const LayoutDashboard = createLucideIcon("layout-dashboard", [["rect",{"width":"7","height":"9","x":"3","y":"3","rx":"1","key":"10lvy0"}],["rect",{"width":"7","height":"5","x":"14","y":"3","rx":"1","key":"16une8"}],["rect",{"width":"7","height":"9","x":"14","y":"12","rx":"1","key":"1hutg5"}],["rect",{"width":"7","height":"5","x":"3","y":"16","rx":"1","key":"ldoo1y"}]]);
export const Loader2 = createLucideIcon("loader-circle", [["path",{"d":"M21 12a9 9 0 1 1-6.219-8.56","key":"13zald"}]]);
export const Lock = createLucideIcon("lock", [["rect",{"width":"18","height":"11","x":"3","y":"11","rx":"2","ry":"2","key":"1w4ew1"}],["path",{"d":"M7 11V7a5 5 0 0 1 10 0v4","key":"fwvmzm"}]]);
export const LogOut = createLucideIcon("log-out", [["path",{"d":"m16 17 5-5-5-5","key":"1bji2h"}],["path",{"d":"M21 12H9","key":"dn1m92"}],["path",{"d":"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4","key":"1uf3rs"}]]);
export const Mail = createLucideIcon("mail", [["path",{"d":"m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7","key":"132q7q"}],["rect",{"x":"2","y":"4","width":"20","height":"16","rx":"2","key":"izxlao"}]]);
export const MailCheck = createLucideIcon("mail-check", [["path",{"d":"M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8","key":"12jkf8"}],["path",{"d":"m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7","key":"1ocrg3"}],["path",{"d":"m16 19 2 2 4-4","key":"1b14m6"}]]);
export const MapPin = createLucideIcon("map-pin", [["path",{"d":"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0","key":"1r0f0z"}],["circle",{"cx":"12","cy":"10","r":"3","key":"ilqhr7"}]]);
export const Maximize2 = createLucideIcon("maximize-2", [["path",{"d":"M15 3h6v6","key":"1q9fwt"}],["path",{"d":"m21 3-7 7","key":"1l2asr"}],["path",{"d":"m3 21 7-7","key":"tjx5ai"}],["path",{"d":"M9 21H3v-6","key":"wtvkvv"}]]);
export const Menu = createLucideIcon("menu", [["path",{"d":"M4 5h16","key":"1tepv9"}],["path",{"d":"M4 12h16","key":"1lakjw"}],["path",{"d":"M4 19h16","key":"1djgab"}]]);
export const Minimize2 = createLucideIcon("minimize-2", [["path",{"d":"m14 10 7-7","key":"oa77jy"}],["path",{"d":"M20 10h-6V4","key":"mjg0md"}],["path",{"d":"m3 21 7-7","key":"tjx5ai"}],["path",{"d":"M4 14h6v6","key":"rmj7iw"}]]);
export const Minus = createLucideIcon("minus", [["path",{"d":"M5 12h14","key":"1ays0h"}]]);
export const MinusCircle = createLucideIcon("circle-minus", [["circle",{"cx":"12","cy":"12","r":"10","key":"1mglay"}],["path",{"d":"M8 12h8","key":"1wcyev"}]]);
export const Monitor = createLucideIcon("monitor", [["rect",{"width":"20","height":"14","x":"2","y":"3","rx":"2","key":"48i651"}],["line",{"x1":"8","x2":"16","y1":"21","y2":"21","key":"1svkeh"}],["line",{"x1":"12","x2":"12","y1":"17","y2":"21","key":"vw1qmm"}]]);
export const MoveHorizontal = createLucideIcon("move-horizontal", [["path",{"d":"m18 8 4 4-4 4","key":"1ak13k"}],["path",{"d":"M2 12h20","key":"9i4pu4"}],["path",{"d":"m6 8-4 4 4 4","key":"15zrgr"}]]);
export const Package = createLucideIcon("package", [["path",{"d":"M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z","key":"1a0edw"}],["path",{"d":"M12 22V12","key":"d0xqtd"}],["polyline",{"points":"3.29 7 12 12 20.71 7","key":"ousv84"}],["path",{"d":"m7.5 4.27 9 5.15","key":"1c824w"}]]);
export const PackageCheck = createLucideIcon("package-check", [["path",{"d":"m16 16 2 2 4-4","key":"gfu2re"}],["path",{"d":"M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14","key":"e7tb2h"}],["path",{"d":"m7.5 4.27 9 5.15","key":"1c824w"}],["polyline",{"points":"3.29 7 12 12 20.71 7","key":"ousv84"}],["line",{"x1":"12","x2":"12","y1":"22","y2":"12","key":"a4e8g8"}]]);
export const PanelLeft = createLucideIcon("panel-left", [["rect",{"width":"18","height":"18","x":"3","y":"3","rx":"2","key":"afitv7"}],["path",{"d":"M9 3v18","key":"fh3hqa"}]]);
export const Paperclip = createLucideIcon("paperclip", [["path",{"d":"m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551","key":"1miecu"}]]);
export const Pause = createLucideIcon("pause", [["rect",{"x":"14","y":"3","width":"5","height":"18","rx":"1","key":"kaeet6"}],["rect",{"x":"5","y":"3","width":"5","height":"18","rx":"1","key":"1wsw3u"}]]);
export const PauseCircle = createLucideIcon("circle-pause", [["circle",{"cx":"12","cy":"12","r":"10","key":"1mglay"}],["line",{"x1":"10","x2":"10","y1":"15","y2":"9","key":"c1nkhi"}],["line",{"x1":"14","x2":"14","y1":"15","y2":"9","key":"h65svq"}]]);
export const PenTool = createLucideIcon("pen-tool", [["path",{"d":"M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z","key":"nt11vn"}],["path",{"d":"m18 13-1.375-6.874a1 1 0 0 0-.746-.776L3.235 2.028a1 1 0 0 0-1.207 1.207L5.35 15.879a1 1 0 0 0 .776.746L13 18","key":"15qc1e"}],["path",{"d":"m2.3 2.3 7.286 7.286","key":"1wuzzi"}],["circle",{"cx":"11","cy":"11","r":"2","key":"xmgehs"}]]);
export const Percent = createLucideIcon("percent", [["line",{"x1":"19","x2":"5","y1":"5","y2":"19","key":"1x9vlm"}],["circle",{"cx":"6.5","cy":"6.5","r":"2.5","key":"4mh3h7"}],["circle",{"cx":"17.5","cy":"17.5","r":"2.5","key":"1mdrzq"}]]);
export const Phone = createLucideIcon("phone", [["path",{"d":"M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384","key":"9njp5v"}]]);
export const PieChart = createLucideIcon("chart-pie", [["path",{"d":"M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z","key":"pzmjnu"}],["path",{"d":"M21.21 15.89A10 10 0 1 1 8 2.83","key":"k2fpak"}]]);
export const Plane = createLucideIcon("plane", [["path",{"d":"M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z","key":"1v9wt8"}]]);
export const Play = createLucideIcon("play", [["path",{"d":"M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z","key":"10ikf1"}]]);
export const PlayCircle = createLucideIcon("circle-play", [["path",{"d":"M9 9.003a1 1 0 0 1 1.517-.859l4.997 2.997a1 1 0 0 1 0 1.718l-4.997 2.997A1 1 0 0 1 9 14.996z","key":"kmsa83"}],["circle",{"cx":"12","cy":"12","r":"10","key":"1mglay"}]]);
export const Plus = createLucideIcon("plus", [["path",{"d":"M5 12h14","key":"1ays0h"}],["path",{"d":"M12 5v14","key":"s699le"}]]);
export const PlusCircle = createLucideIcon("circle-plus", [["circle",{"cx":"12","cy":"12","r":"10","key":"1mglay"}],["path",{"d":"M8 12h8","key":"1wcyev"}],["path",{"d":"M12 8v8","key":"napkw2"}]]);
export const Power = createLucideIcon("power", [["path",{"d":"M12 2v10","key":"mnfbl"}],["path",{"d":"M18.4 6.6a9 9 0 1 1-12.77.04","key":"obofu9"}]]);
export const Printer = createLucideIcon("printer", [["path",{"d":"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2","key":"143wyd"}],["path",{"d":"M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6","key":"1itne7"}],["rect",{"x":"6","y":"14","width":"12","height":"8","rx":"1","key":"1ue0tg"}]]);
export const QrCode = createLucideIcon("qr-code", [["rect",{"width":"5","height":"5","x":"3","y":"3","rx":"1","key":"1tu5fj"}],["rect",{"width":"5","height":"5","x":"16","y":"3","rx":"1","key":"1v8r4q"}],["rect",{"width":"5","height":"5","x":"3","y":"16","rx":"1","key":"1x03jg"}],["path",{"d":"M21 16h-3a2 2 0 0 0-2 2v3","key":"177gqh"}],["path",{"d":"M21 21v.01","key":"ents32"}],["path",{"d":"M12 7v3a2 2 0 0 1-2 2H7","key":"8crl2c"}],["path",{"d":"M3 12h.01","key":"nlz23k"}],["path",{"d":"M12 3h.01","key":"n36tog"}],["path",{"d":"M12 16v.01","key":"133mhm"}],["path",{"d":"M16 12h1","key":"1slzba"}],["path",{"d":"M21 12v.01","key":"1lwtk9"}],["path",{"d":"M12 21v-1","key":"1880an"}]]);
export const Receipt = createLucideIcon("receipt", [["path",{"d":"M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z","key":"q3az6g"}],["path",{"d":"M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8","key":"1h4pet"}],["path",{"d":"M12 17.5v-11","key":"1jc1ny"}]]);
export const ReceiptText = createLucideIcon("receipt-text", [["path",{"d":"M13 16H8","key":"wsln4y"}],["path",{"d":"M14 8H8","key":"1l3xfs"}],["path",{"d":"M16 12H8","key":"1fr5h0"}],["path",{"d":"M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z","key":"ycz6yz"}]]);
export const RefreshCw = createLucideIcon("refresh-cw", [["path",{"d":"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8","key":"v9h5vc"}],["path",{"d":"M21 3v5h-5","key":"1q7to0"}],["path",{"d":"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16","key":"3uifl3"}],["path",{"d":"M8 16H3v5","key":"1cv678"}]]);
export const Repeat = createLucideIcon("repeat", [["path",{"d":"m17 2 4 4-4 4","key":"nntrym"}],["path",{"d":"M3 11v-1a4 4 0 0 1 4-4h14","key":"84bu3i"}],["path",{"d":"m7 22-4-4 4-4","key":"1wqhfi"}],["path",{"d":"M21 13v1a4 4 0 0 1-4 4H3","key":"1rx37r"}]]);
export const RotateCcw = createLucideIcon("rotate-ccw", [["path",{"d":"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8","key":"1357e3"}],["path",{"d":"M3 3v5h5","key":"1xhq8a"}]]);
export const Save = createLucideIcon("save", [["path",{"d":"M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z","key":"1c8476"}],["path",{"d":"M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7","key":"1ydtos"}],["path",{"d":"M7 3v4a1 1 0 0 0 1 1h7","key":"t51u73"}]]);
export const Scale = createLucideIcon("scale", [["path",{"d":"m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z","key":"7g6ntu"}],["path",{"d":"m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z","key":"ijws7r"}],["path",{"d":"M7 21h10","key":"1b0cd5"}],["path",{"d":"M12 3v18","key":"108xh3"}],["path",{"d":"M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2","key":"3gwbw2"}]]);
export const Search = createLucideIcon("search", [["path",{"d":"m21 21-4.34-4.34","key":"14j7rj"}],["circle",{"cx":"11","cy":"11","r":"8","key":"4ej97u"}]]);
export const Send = createLucideIcon("send", [["path",{"d":"M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z","key":"1ffxy3"}],["path",{"d":"m21.854 2.147-10.94 10.939","key":"12cjpa"}]]);
export const Settings = createLucideIcon("settings", [["path",{"d":"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915","key":"1i5ecw"}],["circle",{"cx":"12","cy":"12","r":"3","key":"1v7zrd"}]]);
export const ShieldAlert = createLucideIcon("shield-alert", [["path",{"d":"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z","key":"oel41y"}],["path",{"d":"M12 8v4","key":"1got3b"}],["path",{"d":"M12 16h.01","key":"1drbdi"}]]);
export const ShieldCheck = createLucideIcon("shield-check", [["path",{"d":"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z","key":"oel41y"}],["path",{"d":"m9 12 2 2 4-4","key":"dzmm74"}]]);
export const ShoppingCart = createLucideIcon("shopping-cart", [["circle",{"cx":"8","cy":"21","r":"1","key":"jimo8o"}],["circle",{"cx":"19","cy":"21","r":"1","key":"13723u"}],["path",{"d":"M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12","key":"9zh506"}]]);
export const SlidersHorizontal = createLucideIcon("sliders-horizontal", [["path",{"d":"M10 5H3","key":"1qgfaw"}],["path",{"d":"M12 19H3","key":"yhmn1j"}],["path",{"d":"M14 3v4","key":"1sua03"}],["path",{"d":"M16 17v4","key":"1q0r14"}],["path",{"d":"M21 12h-9","key":"1o4lsq"}],["path",{"d":"M21 19h-5","key":"1rlt1p"}],["path",{"d":"M21 5h-7","key":"1oszz2"}],["path",{"d":"M8 10v4","key":"tgpxqk"}],["path",{"d":"M8 12H3","key":"a7s4jb"}]]);
export const Smartphone = createLucideIcon("smartphone", [["rect",{"width":"14","height":"20","x":"5","y":"2","rx":"2","ry":"2","key":"1yt0o3"}],["path",{"d":"M12 18h.01","key":"mhygvu"}]]);
export const Sparkles = createLucideIcon("sparkles", [["path",{"d":"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z","key":"1s2grr"}],["path",{"d":"M20 2v4","key":"1rf3ol"}],["path",{"d":"M22 4h-4","key":"gwowj6"}],["circle",{"cx":"4","cy":"20","r":"2","key":"6kqj1y"}]]);
export const Square = createLucideIcon("square", [["rect",{"width":"18","height":"18","x":"3","y":"3","rx":"2","key":"afitv7"}]]);
export const StickyNote = createLucideIcon("sticky-note", [["path",{"d":"M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z","key":"qazsjp"}],["path",{"d":"M15 3v4a2 2 0 0 0 2 2h4","key":"40519r"}]]);
export const Table = createLucideIcon("table", [["path",{"d":"M12 3v18","key":"108xh3"}],["rect",{"width":"18","height":"18","x":"3","y":"3","rx":"2","key":"afitv7"}],["path",{"d":"M3 9h18","key":"1pudct"}],["path",{"d":"M3 15h18","key":"5xshup"}]]);
export const Table2 = createLucideIcon("table-2", [["path",{"d":"M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18","key":"gugj83"}]]);
export const Tag = createLucideIcon("tag", [["path",{"d":"M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z","key":"vktsd0"}],["circle",{"cx":"7.5","cy":"7.5","r":".5","fill":"currentColor","key":"kqv944"}]]);
export const Trash2 = createLucideIcon("trash-2", [["path",{"d":"M10 11v6","key":"nco0om"}],["path",{"d":"M14 11v6","key":"outv1u"}],["path",{"d":"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6","key":"miytrc"}],["path",{"d":"M3 6h18","key":"d0wm0j"}],["path",{"d":"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2","key":"e791ji"}]]);
export const TrendingDown = createLucideIcon("trending-down", [["path",{"d":"M16 17h6v-6","key":"t6n2it"}],["path",{"d":"m22 17-8.5-8.5-5 5L2 7","key":"x473p"}]]);
export const TrendingUp = createLucideIcon("trending-up", [["path",{"d":"M16 7h6v6","key":"box55l"}],["path",{"d":"m22 7-8.5 8.5-5-5L2 17","key":"1t1m79"}]]);
export const Unlock = createLucideIcon("lock-open", [["rect",{"width":"18","height":"11","x":"3","y":"11","rx":"2","ry":"2","key":"1w4ew1"}],["path",{"d":"M7 11V7a5 5 0 0 1 9.9-1","key":"1mm8w8"}]]);
export const Upload = createLucideIcon("upload", [["path",{"d":"M12 3v12","key":"1x0j5s"}],["path",{"d":"m17 8-5-5-5 5","key":"7q97r8"}],["path",{"d":"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4","key":"ih7n3h"}]]);
export const UploadCloud = createLucideIcon("cloud-upload", [["path",{"d":"M12 13v8","key":"1l5pq0"}],["path",{"d":"M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242","key":"1pljnt"}],["path",{"d":"m8 17 4-4 4 4","key":"1quai1"}]]);
export const User = createLucideIcon("user", [["path",{"d":"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2","key":"975kel"}],["circle",{"cx":"12","cy":"7","r":"4","key":"17ys0d"}]]);
export const UserCheck = createLucideIcon("user-check", [["path",{"d":"m16 11 2 2 4-4","key":"9rsbq5"}],["path",{"d":"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2","key":"1yyitq"}],["circle",{"cx":"9","cy":"7","r":"4","key":"nufk8"}]]);
export const UserMinus = createLucideIcon("user-minus", [["path",{"d":"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2","key":"1yyitq"}],["circle",{"cx":"9","cy":"7","r":"4","key":"nufk8"}],["line",{"x1":"22","x2":"16","y1":"11","y2":"11","key":"1shjgl"}]]);
export const UserPlus = createLucideIcon("user-plus", [["path",{"d":"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2","key":"1yyitq"}],["circle",{"cx":"9","cy":"7","r":"4","key":"nufk8"}],["line",{"x1":"19","x2":"19","y1":"8","y2":"14","key":"1bvyxn"}],["line",{"x1":"22","x2":"16","y1":"11","y2":"11","key":"1shjgl"}]]);
export const Users = createLucideIcon("users", [["path",{"d":"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2","key":"1yyitq"}],["path",{"d":"M16 3.128a4 4 0 0 1 0 7.744","key":"16gr8j"}],["path",{"d":"M22 21v-2a4 4 0 0 0-3-3.87","key":"kshegd"}],["circle",{"cx":"9","cy":"7","r":"4","key":"nufk8"}]]);
export const Wallet = createLucideIcon("wallet", [["path",{"d":"M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1","key":"18etb6"}],["path",{"d":"M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4","key":"xoc0q4"}]]);
export const Wifi = createLucideIcon("wifi", [["path",{"d":"M12 20h.01","key":"zekei9"}],["path",{"d":"M2 8.82a15 15 0 0 1 20 0","key":"dnpr2z"}],["path",{"d":"M5 12.859a10 10 0 0 1 14 0","key":"1x1e6c"}],["path",{"d":"M8.5 16.429a5 5 0 0 1 7 0","key":"1bycff"}]]);
export const WifiOff = createLucideIcon("wifi-off", [["path",{"d":"M12 20h.01","key":"zekei9"}],["path",{"d":"M8.5 16.429a5 5 0 0 1 7 0","key":"1bycff"}],["path",{"d":"M5 12.859a10 10 0 0 1 5.17-2.69","key":"1dl1wf"}],["path",{"d":"M19 12.859a10 10 0 0 0-2.007-1.523","key":"4k23kn"}],["path",{"d":"M2 8.82a15 15 0 0 1 4.177-2.643","key":"1grhjp"}],["path",{"d":"M22 8.82a15 15 0 0 0-11.288-3.764","key":"z3jwby"}],["path",{"d":"m2 2 20 20","key":"1ooewy"}]]);
export const X = createLucideIcon("x", [["path",{"d":"M18 6 6 18","key":"1bl5f8"}],["path",{"d":"m6 6 12 12","key":"d8bk6v"}]]);
export const Zap = createLucideIcon("zap", [["path",{"d":"M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z","key":"1xq2db"}]]);
export const ZoomIn = createLucideIcon("zoom-in", [["circle",{"cx":"11","cy":"11","r":"8","key":"4ej97u"}],["line",{"x1":"21","x2":"16.65","y1":"21","y2":"16.65","key":"13gj7c"}],["line",{"x1":"11","x2":"11","y1":"8","y2":"14","key":"1vmskp"}],["line",{"x1":"8","x2":"14","y1":"11","y2":"11","key":"durymu"}]]);
export const ZoomOut = createLucideIcon("zoom-out", [["circle",{"cx":"11","cy":"11","r":"8","key":"4ej97u"}],["line",{"x1":"21","x2":"16.65","y1":"21","y2":"16.65","key":"13gj7c"}],["line",{"x1":"8","x2":"14","y1":"11","y2":"11","key":"durymu"}]]);
