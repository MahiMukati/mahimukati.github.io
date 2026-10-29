// get the ninja-keys element
const ninja = document.querySelector('ninja-keys');

// add the home and posts menu items
ninja.data = [{
    id: "nav-about",
    title: "About",
    section: "Navigation",
    handler: () => {
      window.location.href = "/";
    },
  },{id: "nav-projects",
          title: "Projects",
          description: "Systems programming, desktop software, and a browser extension MVP.",
          section: "Navigation",
          handler: () => {
            window.location.href = "/projects/";
          },
        },{id: "nav-résumé",
          title: "Résumé",
          description: "Software development experience, education, projects, and community leadership.",
          section: "Navigation",
          handler: () => {
            window.location.href = "/cv/";
          },
        },{id: "nav-blog",
          title: "Blog",
          description: "Notes on software development and what I learn along the way.",
          section: "Navigation",
          handler: () => {
            window.location.href = "/blog/";
          },
        },{id: "projects-amd-schola-for-unity",
          title: 'AMD Schola for Unity',
          description: "Extending AMD Schola to Unity with reusable agent interfaces, episode control, and local ONNX inference.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/amd-schola/";
            },},{id: "projects-impulseguard",
          title: 'ImpulseGuard',
          description: "Browser extension MVP with AI purchase classification and a 24-hour checkout block; fourth of 32 teams at Ibtikar Waterloo.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/impulseguard/";
            },},{id: "projects-jraw",
          title: 'Jraw',
          description: "JavaFX drawing application with shape editing, save/load, and undo/redo using MVC and design patterns.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/jraw/";
            },},{id: "projects-mysh",
          title: 'MYSH',
          description: "Unix-like shell in C with process management, pipelines, environment expansion, and socket-based messaging.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/mysh/";
            },},{
        id: 'social-email',
        title: 'email',
        section: 'Socials',
        handler: () => {
          window.open("mailto:%6D%61%68%69.%6D%75%6B%61%74%69@%6D%61%69%6C.%75%74%6F%72%6F%6E%74%6F.%63%61", "_blank");
        },
      },{
        id: 'social-linkedin',
        title: 'LinkedIn',
        section: 'Socials',
        handler: () => {
          window.open("https://www.linkedin.com/in/mahimukati", "_blank");
        },
      },{
        id: 'social-github',
        title: 'GitHub',
        section: 'Socials',
        handler: () => {
          window.open("https://github.com/MahiMukati", "_blank");
        },
      },{
      id: 'light-theme',
      title: 'Change theme to light',
      description: 'Change the theme of the site to Light',
      section: 'Theme',
      handler: () => {
        setThemeSetting("light");
      },
    },
    {
      id: 'dark-theme',
      title: 'Change theme to dark',
      description: 'Change the theme of the site to Dark',
      section: 'Theme',
      handler: () => {
        setThemeSetting("dark");
      },
    },
    {
      id: 'system-theme',
      title: 'Use system default theme',
      description: 'Change the theme of the site to System Default',
      section: 'Theme',
      handler: () => {
        setThemeSetting("system");
      },
    },];
