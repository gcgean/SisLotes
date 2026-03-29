import 'reflect-metadata';
import { AppDataSource } from './src/db/data-source';

AppDataSource.initialize()
  .then(async () => {
    const result = await AppDataSource.query(
      `SELECT id_usuario, login, id_empresa, user_master FROM usuarios LIMIT 10`
    );
    console.log('Usuarios:', JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error('Erro completo:', err);
    process.exit(1);
  });
