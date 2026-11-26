export interface Project {
  title: string;
  description: string;
  image: string;
  tags: string[];
  demoUrl?: string;
  repoUrl?: string;
}

export const projects: Project[] = [
  {
    title: 'Hada Madrina Aromas',
    description:
      'Tienda online completa con catálogo autoadministrable, autenticación de usuarios, checkout con Mercado Pago y notificaciones automáticas por email.',
    image: 'Proyectos/Hada-madrina.png', 
    tags: ['Astro', 'Tailwind', 'Sanity CMS', 'Mercado Pago', 'Firebase'],
    demoUrl: 'https://hada-madrina-web.vercel.app/',
  },
  {
    title: 'ReservApp',
    description:
      'Aplicación móvil para la gestión y reserva de mesas en restaurantes con base de datos en tiempo real en la nube.',
    image: 'Proyectos/reservapp.png',
    tags: ['Android', 'Firebase Firestore', 'Gestión en tiempo real'],
  },
];