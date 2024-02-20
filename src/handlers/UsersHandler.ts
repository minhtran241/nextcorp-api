import { t } from 'elysia';
import { internalServerError, userNotFound } from '~messages/failure';
import pool from '~database/db';
import Cursor from 'pg-cursor';
import APIError from '~errors/APIError';
import ApiResponse from '~types/APIResponse';

const MAX_USERS_FETCH: number = parseInt(process.env.MAX_USERS_FETCH || '100');
interface createUserPayload {
    username: string;
    password: string;
    email: string;
    avatar: string;
    isAdmin: boolean;
}

interface loginPayload {
    username: string;
    password: string;
}

export const usersHandler = {
    getUsers: async ({}) => {
        try {
            const client = await pool.connect();
            // use cursor to fetch all users for better performance
            const cursor = client.query(
                new Cursor('SELECT * FROM public.users')
            );
            const users = await cursor.read(MAX_USERS_FETCH);
            cursor.close();
            client.release();
            return users;
        } catch (error: any) {
            throw new APIError(
                error.statusCode || 500,
                error.message || internalServerError
            );
        }
    },

    getUser: async ({
        params: { id },
        set,
    }: {
        params: { id: string };
        set: any;
    }) => {
        try {
            const user = await pool.query(
                'SELECT * FROM public.users WHERE id = $1',
                [parseInt(id)]
            );
            if (user.rows.length === 0) {
                set.status = 404;
                throw new APIError(404, userNotFound);
            }
            delete user.rows[0].password;
            console.log(user.rows[0]);
            return user.rows[0];
        } catch (error: any) {
            throw new APIError(
                error.statusCode || 500,
                error.message || internalServerError
            );
        }
    },

    createUser: async ({
        body: { username, password, email, avatar, isAdmin },
        set,
    }: {
        body: createUserPayload;
        set: any;
    }) => {
        try {
            const hashedPassword = await Bun.password.hash(password);
            // This will throw an error if the username or email already exists
            const user = await pool.query(
                'INSERT INTO public.users (username, password, email, avatar, is_admin) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [username, hashedPassword, email, avatar, isAdmin]
            );
            set.status = 201;
            const res: ApiResponse = {
                status: 201,
                message: 'User created successfully',
                data: user.rows[0],
                timestamp: new Date(),
            };
            return res;
        } catch (error: any) {
            // If the error is a unique constraint violation, return a 409 status code
            if (error.code === '23505') {
                set.status = 409;
                error.statusCode = 409;
                error.message = 'Username or email already exists';
            }
            throw new APIError(
                error.statusCode || 500,
                error.message || internalServerError
            );
        }
    },

    deleteUser: async ({
        params: { id },
        set,
    }: {
        params: { id: string };
        set: any;
    }) => {
        try {
            // Convert id to number
            const userId = parseInt(id);
            const user = await pool.query(
                'DELETE FROM public.users WHERE id = $1 RETURNING *',
                [userId]
            );
            if (user.rows.length === 0) {
                set.status = 404;
                throw new APIError(404, userNotFound);
            }
            set.status = 200;
            const res: ApiResponse = {
                status: 200,
                message: 'User deleted successfully',
                data: user.rows[0],
                timestamp: new Date(),
            };
            return res;
        } catch (error: any) {
            throw new APIError(
                error.statusCode || 500,
                error.message || internalServerError
            );
        }
    },

    validateCreateUser: t.Object({
        username: t.String(),
        password: t.String(),
        email: t.String(),
        avatar: t.String(),
        isAdmin: t.Boolean(),
    }),
};
