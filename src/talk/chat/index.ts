/*
 * Created on Sun Jan 31 2021
 *
 * Copyright (c) storycraft. Licensed under the MIT Licence.
 */

import { Long } from 'bson';
import { Chatlog, getOriginalType, isDeletedChat } from '../../chat';
import { MediaKeyComponent } from '../../media';
import { ChannelUser } from '../../user';
import { TalkChannel } from '../channel';

/**
 * Store Chatlog and provides convenient methods.
 */
export class TalkChatData {
  constructor(private _chat: Chatlog) {

  }

  /**
   * Chatlog object
   */
  get chat(): Readonly<Chatlog> {
    return this._chat;
  }

  /**
   * The chat object's type property has the type value bit masked when the chat is deleted.
   * @return {number} the original chat type
   */
  get originalType(): number {
    return getOriginalType(this._chat.type);
  }

  /**
   * Get url list in chat. Can be used to generate url preview.
   * It is not for detecting urls.
   */
  get urls(): string[] {
    if (!this._chat.attachment || !Array.isArray(this._chat.attachment['urls'])) return [];

    return this._chat.attachment['urls'];
  }

  /**
   * Get mention list
   */
  get mentions(): ChatMentionStruct[] {
    if (!this._chat.attachment || !Array.isArray(this._chat.attachment.mentions)) return [];

    return this._chat.attachment.mentions;
  }

  /**
   * Get medias on chat.
   */
  get medias(): MediaKeyComponent[] {
    if (!this._chat.attachment) return [];

    if (this._chat.attachment['kl']) {
      return (this._chat.attachment['kl'] as string[]).map((key) => {
        return { key } as MediaKeyComponent;
      });
    } else if (this._chat.attachment['k']) {
      return [{ key: this._chat.attachment['k'] as string }];
    }

    return [];
  }

  /**
   * Forward chat to another channel
   *
   * @param {TalkChannel} channel
   */
  forwardTo(channel: TalkChannel): void {
    channel.forwardChat(this._chat);
  }

  /**
   * @return {boolean} true when the chat is deleted.
   */
  isDeleted(): boolean {
    return isDeletedChat(this._chat.type);
  }

  /**
   * Check if any users are mentioned.
   *
   * @param {ChannelUser[]} users Users to find
   * @return {boolean} true if anyone is mentioned
   */
  isMentioned(...users: ChannelUser[]): boolean {
    const mentions = this.mentions;
    if (mentions.length < 1) return false;

    for (const mention of mentions) {
      const userId = mention.user_id;

      for (const user of users) {
        if (user.userId.eq(userId)) return true;
      }
    }

    return false;
  }
}

/**
 * Raw chat mention typings
 */
export interface ChatMentionStruct {

  /**
   * Index list
   */
  at: number[];

  /**
   * Mention text length, except @ prefix.
   */
  len: number;

  /**
   * Target user id
   */
  // eslint-disable-next-line camelcase
  user_id: Long | number;

}
