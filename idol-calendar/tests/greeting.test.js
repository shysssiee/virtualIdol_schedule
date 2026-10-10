import test from 'node:test';
import assert from 'node:assert/strict';
import {greeting} from '../docs/greeting.js';
test('Greeting follows reader timezone and morning/noon/evening boundaries',()=>{
 for(const [hour,label] of [[4,'晚安'],[5,'早安'],[11,'早安'],[12,'午安'],[17,'午安'],[18,'晚安']]) assert.equal(greeting('丸丸','UTC',new Date(`2026-10-10T${String(hour).padStart(2,'0')}:00:00Z`)),`哈囉～丸丸，${label}！`);
 assert.equal(greeting('丸丸','Asia/Seoul',new Date('2026-10-10T03:00:00Z')),'哈囉～丸丸，午安！');
});
