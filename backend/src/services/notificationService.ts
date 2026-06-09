import mongoose from 'mongoose';
import { Notification, NotificationType } from '../models/Notification';
import { User } from '../models/User';
import { sendNotificationEmail } from '../utils/email';

export const createNotification = async (
  userId: mongoose.Types.ObjectId | string,
  type: NotificationType,
  title: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> => {
  await Notification.create({ userId, type, title, message, metadata });

  const user = await User.findById(userId);
  if (user?.email) {
    sendNotificationEmail(user.email, title, message).catch(console.error);
  }
};
