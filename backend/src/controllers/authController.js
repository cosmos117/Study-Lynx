import { getUserById, loginUser, registerUser } from '../services/authService.js';

export async function register(request, response) {
  const { name, email, password } = request.body;
  const result = await registerUser({ name, email, password });

  response.status(201).json({ success: true, data: result });
}

export async function login(request, response) {
  const { email, password } = request.body;
  const result = await loginUser({ email, password });

  response.json({ success: true, data: result });
}

export async function me(request, response) {
  const user = await getUserById(request.user.id);
  response.json({ success: true, data: { user } });
}
