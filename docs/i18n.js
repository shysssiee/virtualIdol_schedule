// UI translations only. User content and stored form values are never rewritten.
export const languages = { 'zh-Hant': '繁體中文', en: 'English', ko: '한국어', ja: '日本語' };
let language = 'zh-Hant';
try { const saved = globalThis.localStorage?.getItem('calendar-language'); if (Object.hasOwn(languages,saved)) language = saved; } catch {}
export const getLanguage = () => language;
export const locale = () => ({'zh-Hant':'zh-TW',en:'en-US',ko:'ko-KR',ja:'ja-JP'})[language];
export function setLanguage(value) { language = Object.hasOwn(languages,value) ? value : 'zh-Hant'; try { globalThis.localStorage?.setItem('calendar-language',language); } catch {} return language; }
const rows = `
語言|Language|언어|言語
直播行程|Live schedule|라이브 일정|配信スケジュール
過往紀錄|Past streams|지난 방송|過去の配信
過往直播紀錄|Past streams|지난 방송 기록|過去の配信記録
協作者申請|Apply to contribute|협업자 신청|協力者への応募
問題回報|Report an issue|문제 신고|問題を報告
協作者登入|Contributor sign in|협업자 로그인|協力者ログイン
站主管理|Administration|관리|管理
＋ 新增行程|＋ Add stream|＋ 일정 추가|＋ 予定を追加
新增行程|Add stream|일정 추가|予定を追加
修改密碼|Change password|비밀번호 변경|パスワード変更
登出|Sign out|로그아웃|ログアウト
登入|Sign in|로그인|ログイン
忘記密碼|Forgot password|비밀번호 찾기|パスワードを忘れた場合
密碼|Password|비밀번호|パスワード
團體與平台篩選|Group and platform filters|그룹 및 플랫폼 필터|グループ・プラットフォーム絞り込み
搜尋團體|Search groups|그룹 검색|グループを検索
輸入團體名稱…|Enter a group name…|그룹 이름 입력…|グループ名を入力…
全選|Select all|전체 선택|すべて選択
取消全選|Deselect all|전체 선택 해제|すべて解除
清除|Clear|초기화|クリア
活動分類|Category|카테고리|カテゴリー
全部分類|All categories|모든 카테고리|すべてのカテゴリー
直播平台|Platform|방송 플랫폼|配信プラットフォーム
全部平台|All platforms|모든 플랫폼|すべてのプラットフォーム
行程顯示時區|Display time zone|일정 표시 시간대|予定の表示タイムゾーン
台灣時間|Taiwan Time|대만 시간|台湾時間
香港／澳門時間|Hong Kong / Macau Time|홍콩 / 마카오 시간|香港／マカオ時間
韓國時間|Korea Time|한국 시간|韓国時間
日本時間|Japan Time|일본 시간|日本時間
紐約時間|New York Time|뉴욕 시간|ニューヨーク時間
洛杉磯時間|Los Angeles Time|로스앤젤레스 시간|ロサンゼルス時間
倫敦時間|London Time|런던 시간|ロンドン時間
自動：裝置時區|Automatic: device time zone|자동: 기기 시간대|自動：端末のタイムゾーン
自動：讀者裝置時區|Automatic: visitor’s time zone|자동: 방문자 기기 시간대|自動：閲覧者のタイムゾーン
網站預設|Website default|사이트 기본값|サイトの既定値
行程顯示：|Displayed in: |일정 표시: |予定の表示：
年曆顯示|Calendar overlays|달력 표시|暦の表示
台灣年曆（含農曆）|Taiwan calendar (with lunar dates)|대만 달력 (음력 포함)|台湾の暦（旧暦を含む）
韓國年曆（含農曆）|Korean calendar (with lunar dates)|한국 달력 (음력 포함)|韓国の暦（旧暦を含む）
台灣含行政機關假日、補假與補班。|Taiwan: public holidays, substitute holidays and make-up workdays.|대만 공휴일, 대체 휴일 및 대체 근무일 포함.|台湾の官公庁の祝日・振替休日・振替出勤日を含みます。
行政年曆讀取中…|Loading public calendar…|공휴일 달력 불러오는 중…|行政カレンダーを読み込み中…
月|Month|월|月
週|Week|주|週
日|Day|일|日
列表|List|목록|リスト
今天|Today|오늘|今日
選擇日期|Choose a date|날짜 선택|日付を選択
日期篩選|Date filter|날짜 필터|日付で絞り込み
上一期|Previous period|이전 기간|前の期間
下一期|Next period|다음 기간|次の期間
日曆檢視|Calendar view|달력 보기|カレンダー表示
團體顏色圖例|Group color legend|그룹 색상 범례|グループの色の凡例
近期生日／紀念日|Upcoming birthdays / anniversaries|다가오는 생일 / 기념일|近日の誕生日／記念日
今日行程|Today’s streams|오늘의 일정|今日の予定
直播中優先顯示；結束後恢復時間排序。|Live streams appear first; ended streams return to time order.|방송 중인 일정 우선 표시. 종료 후 시간순으로 정렬합니다.|配信中を優先表示。終了後は時刻順に戻ります。
直播提醒最長顯示兩小時，並非平台開播確認。|Live indicators last up to two hours and do not confirm platform activity.|방송 표시는 최대 2시간이며 실제 방송 여부를 확인한 것은 아닙니다.|配信表示は最長2時間です。実際の配信状況の確認ではありません。
無|None|없음|なし
直播中|Live|방송 중|配信中
即將直播|Starting soon|곧 시작|まもなく配信
預定|Scheduled|예정|配信予定
預定直播|Scheduled|방송 예정|配信予定
已結束|Ended|종료됨|終了
已取消|Cancelled|취소됨|中止
全團|All members|전체 멤버|全員
未分類|Uncategorized|미분류|未分類
成員 / 紀錄|Members / history|멤버 / 기록|メンバー／記録
查看過往紀錄|View past streams|지난 기록 보기|過去の記録を見る
找不到團體|No groups found|그룹을 찾을 수 없습니다|グループが見つかりません
依月份查看|Browse by month|월별 보기|月ごとに表示
時間異動|Time changed|시간 변경|時刻変更
屬於付費會員限定|Paid members only|유료 회원 전용|有料会員限定
開啟直播|Open stream|방송 열기|配信を開く
觀看 YouTube 直播|Watch on YouTube|YouTube에서 보기|YouTubeで見る
分享行程|Share stream|일정 공유|予定を共有
Google 日曆|Google Calendar|Google 캘린더|Google カレンダー
Apple／其他日曆|Apple / other calendars|Apple / 기타 캘린더|Apple／その他のカレンダー
修改紀錄|Edit history|수정 기록|変更履歴
編輯行程|Edit stream|일정 수정|予定を編集
刪除行程|Delete stream|일정 삭제|予定を削除
結束直播|End stream|방송 종료|配信を終了
關閉|Close|닫기|閉じる
行程快速資訊|Stream preview|일정 미리보기|予定のプレビュー
操作通知|Notifications|알림|操作通知
重新載入|Reload|다시 불러오기|再読み込み
重新整理|Refresh|새로고침|更新
暫時無法取得行程|Unable to load streams|일정을 불러올 수 없습니다|予定を取得できません
資料載入失敗，請檢查連線與設定。|Unable to load data. Check your connection and settings.|데이터를 불러오지 못했습니다. 연결과 설정을 확인하세요.|データを読み込めません。接続と設定をご確認ください。
儲存|Save|저장|保存
取消|Cancel|취소|キャンセル
儲存並公開|Save and publish|저장 및 공개|保存して公開
更新成功|Updated successfully|업데이트 완료|更新しました
儲存成功|Saved successfully|저장 완료|保存しました
送出|Submit|제출|送信
確定送出|Confirm submission|제출 확인|送信を確定
修改|Edit|수정|編集
刪除|Delete|삭제|削除
團體|Group|그룹|グループ
成員|Member|멤버|メンバー
標題|Title|제목|タイトル
日期|Date|날짜|日付
時間|Time|시간|時刻
說明|Description|설명|説明
本站後台|Site administration|사이트 관리|サイト管理
返回日曆|Back to calendar|달력으로 돌아가기|カレンダーに戻る
首頁|Home|홈|ホーム
版本更新功能|Release notes|업데이트 안내|更新情報
行程管理|Manage streams|일정 관리|予定の管理
生日／紀念日|Birthdays / anniversaries|생일 / 기념일|誕生日／記念日
網站設定|Site settings|사이트 설정|サイト設定
批次匯入行程|Batch add streams|일정 일괄 추가|予定を一括追加
直播提醒依預定時間顯示，開始後兩小時停止；並非平台開播確認。|Indicators follow scheduled times and stop after two hours; they do not confirm platform activity.|방송 표시는 예정 시간 기준이며 2시간 후 사라집니다. 실제 방송 여부 확인은 아닙니다.|配信表示は予定時刻に基づき、2時間後に消えます。実際の配信状況の確認ではありません。
直播提醒依預定時間顯示 · 開始後兩小時自動停止|Indicators follow scheduled times · Stop automatically after two hours|예정 시간 기준 방송 표시 · 시작 2시간 후 자동 종료|予定時刻に基づく配信表示・開始2時間後に自動終了
本站直播行程依官方公告整理，僅供參考。如有異動，請以官方最新公告為準。|Schedules are based on official announcements and provided for reference. Follow the latest official announcement for changes.|공식 공지를 바탕으로 정리한 참고용 일정입니다. 변경 사항은 최신 공식 공지를 확인하세요.|公式発表に基づく参考用の予定です。変更は最新の公式発表をご確認ください。
加入後請確認提醒設定；行程異動不會自動同步。iPhone 若只顯示檔案預覽，可透過 Apple Mail 開啟 .ics 匯入。|Check reminder settings after adding. Schedule changes do not sync automatically. On iPhone, open the .ics file via Apple Mail if only a preview appears.|추가 후 알림 설정을 확인하세요. 일정 변경은 자동 동기화되지 않습니다. iPhone에서 미리보기만 표시되면 Apple Mail로 .ics를 여세요.|追加後に通知設定をご確認ください。予定変更は自動同期されません。iPhoneでプレビューのみ表示される場合はApple Mailで.icsを開いてください。
帳號由站主建立，不開放自行註冊。|Accounts are created by the site owner. Self-registration is unavailable.|계정은 사이트 관리자가 생성합니다. 직접 가입은 지원하지 않습니다.|アカウントはサイト管理者が作成します。自己登録はできません。
直播網址|Stream URL|방송 URL|配信URL
會員限定|Members only|회원 전용|会員限定
新增成員|Add member|멤버 추가|メンバーを追加
聯絡方式|Contact details|연락처|連絡先
申請暱稱|Requested nickname|신청 닉네임|申請ニックネーム
申請信箱|Email address|신청 이메일|申請メールアドレス
內容|Message|내용|内容
網站BUG|Website bug|사이트 버그|サイトの不具合
行程直播時間錯誤|Incorrect stream time|방송 시간 오류|配信時刻の誤り
名稱錯誤|Incorrect name|이름 오류|名前の誤り
其他|Other|기타|その他
可視直播|Video stream|영상 방송|映像配信
聲音直播|Audio stream|음성 방송|音声配信
生日|Birthday|생일|誕生日
紀念日|Anniversary|기념일|記念日
出道日|Debut anniversary|데뷔일|デビュー記念日
日期或時區無效|Invalid date or time zone|날짜 또는 시간대가 잘못되었습니다|日付またはタイムゾーンが無効です
當日行程|Daily streams|당일 일정|当日の予定
當日暫無行程|No streams on this date|이 날짜에는 일정이 없습니다|この日の予定はありません
目前沒有符合條件的行程|No matching streams|조건에 맞는 일정이 없습니다|条件に一致する予定はありません
沒有符合條件的行程|No matching streams|조건에 맞는 일정이 없습니다|条件に一致する予定はありません
確定刪除這筆行程？|Delete this stream?|이 일정을 삭제할까요?|この予定を削除しますか？
操作失敗|Action failed|작업 실패|操作に失敗しました
通知|Notification|알림|通知
連結已複製|Link copied|링크 복사 완료|リンクをコピーしました
分享連結：|Share link: |공유 링크: |共有リンク：
回報站主|Report to owner|관리자에게 신고|管理者に報告
原時間：|Previous time: |이전 시간: |変更前：
新時間：|New time: |변경 시간: |変更後：
出生紀念日|Birth date|출생일|出生記念日
正式出道|Debut|데뷔|デビュー
其他紀念日|Other anniversary|기타 기념일|その他の記念日
網站預設顯示時區|Default display time zone|기본 표시 시간대|既定の表示タイムゾーン
元旦|New Year’s Day|새해 첫날|元日
國慶日|National Day|국경일|国慶日
補假|Substitute holiday|대체 공휴일|振替休日
補班|Make-up workday|대체 근무일|振替出勤日
放假|Holiday|휴일|休日
行政年曆尚未收錄|Public calendar unavailable|공휴일 달력 미등록|行政カレンダー未収録
開天節|National Foundation Day|개천절|開天節
韓文日|Hangul Day|한글날|ハングルの日
秋夕|Chuseok|추석|秋夕
聖誕節|Christmas|크리스마스|クリスマス
閏|Leap |윤|閏
農曆|Lunar |음력 |旧暦
韓曆|Korean lunar |한국 음력 |韓国旧暦
台：|TW: |대만: |台湾：
韓：|KR: |한국: |韓国：
生日直播|Birthday stream|생일 방송|誕生日配信
出道日紀念|Debut anniversary|데뷔 기념|デビュー記念
雜談|Chat|잡담|雑談
遊戲|Gaming|게임|ゲーム
查看當日行程|View daily streams|당일 일정 보기|当日の予定を見る
查看生日與紀念日|View birthdays and anniversaries|생일 및 기념일 보기|誕生日・記念日を見る
孔子誕辰紀念日/教師節|Confucius’ Birthday / Teachers’ Day|공자 탄신일 / 스승의 날|孔子誕辰記念日／教師の日
臺灣光復暨金門古寧頭大捷紀念日|Taiwan Retrocession and Battle of Guningtou Memorial Day|대만 광복 및 구닝터우 전투 기념일|台湾光復・古寧頭戦役記念日
行政年曆：|Public calendar: |공휴일 달력: |行政カレンダー：
新年|New Year|새해|新年
元宵節|Lantern Festival|정월대보름|元宵節
春節|Lunar New Year|설날|春節
端午節|Dragon Boat Festival|단오절|端午節
中秋節|Mid-Autumn Festival|중추절|中秋節
和平紀念日|Peace Memorial Day|평화 기념일|和平記念日
兒童節|Children’s Day|어린이날|こどもの日
清明節|Tomb Sweeping Day|청명절|清明節
勞動節|Labour Day|노동절|労働節
三一節|Independence Movement Day|삼일절|三一節
佛誕日|Buddha’s Birthday|부처님 오신 날|釈迦誕生日
顯忠日|Memorial Day|현충일|顕忠日
光復節|Liberation Day|광복절|光復節
制憲節|Constitution Day|제헌절|制憲節
唯讀示範 · 團體與行程為虛構資料，設定資料服務後即可正式使用。|Read-only demo · Groups and schedules are fictional. Configure the data service to use the site.|읽기 전용 데모 · 그룹과 일정은 예시입니다. 데이터 서비스를 설정하면 사용할 수 있습니다.|閲覧用デモ・グループと予定は架空のデータです。データサービス設定後に利用できます。
問題類型|Issue type|문제 유형|問題の種類
內容（100字內）|Message (up to 100 characters)|내용 (100자 이내)|内容（100文字以内）
申請資料只供站主查看；送出不會自動建立帳號或授權。|Only the site owner can view applications. Submitting does not create an account or grant access.|신청 정보는 사이트 관리자만 볼 수 있습니다. 제출해도 계정이나 권한이 자동 생성되지 않습니다.|申請情報はサイト管理者のみ閲覧できます。送信してもアカウントや権限は自動作成されません。
問題會送到後台留言板，由站主與協作者查看。|Reports go to the administration board, visible to the owner and contributors.|신고는 관리 게시판에 전달되며 관리자와 협업자가 볼 수 있습니다.|報告は管理掲示板に送られ、管理者と協力者が閲覧できます。
例如社群帳號或其他可聯絡方式|For example, a social account or another contact method|예: 소셜 계정 또는 기타 연락 방법|SNSアカウントなどの連絡方法
尚未設定資料服務，暫時無法送出。|The data service is not configured. Submission is unavailable.|데이터 서비스가 설정되지 않아 제출할 수 없습니다.|データサービス未設定のため送信できません。
送出成功|Submitted successfully|제출 완료|送信しました
申請已送交站主，請等待站主透過你提供的聯絡方式通知。|Your application has been sent. The owner will contact you using the details provided.|신청이 전달되었습니다. 입력한 연락처로 관리자의 연락을 기다려 주세요.|申請を送信しました。記入した連絡先への管理者からの連絡をお待ちください。
問題已送至留言板，謝謝你的回報。|Your report has been sent. Thank you.|게시판에 전달되었습니다. 신고해 주셔서 감사합니다.|報告を掲示板に送信しました。ありがとうございます。
目前是唯讀示範。請依安裝說明設定資料服務後啟用正式登入。|This is a read-only demo. Configure the data service using the installation guide to enable sign in.|읽기 전용 데모입니다. 설치 안내에 따라 데이터 서비스를 설정하면 로그인할 수 있습니다.|閲覧用デモです。インストール手順に従ってデータサービスを設定するとログインできます。
登入失敗，請確認帳號與密碼。|Sign in failed. Check your email and password.|로그인 실패. 이메일과 비밀번호를 확인하세요.|ログインできません。メールアドレスとパスワードをご確認ください。
帳號尚未授權或已停用，請聯絡站主。|This account is not authorized or has been disabled. Contact the owner.|미승인 또는 비활성화된 계정입니다. 관리자에게 문의하세요.|未承認または無効なアカウントです。管理者にお問い合わせください。
登入成功！|Signed in!|로그인 성공!|ログインしました！
開始使用|Get started|시작하기|利用を開始
請先輸入 Email。|Enter your email first.|이메일을 먼저 입력하세요.|先にメールアドレスを入力してください。
若帳號存在，將寄出重設密碼信。|If the account exists, a password reset email will be sent.|계정이 있다면 비밀번호 재설정 이메일이 발송됩니다.|アカウントが存在する場合、パスワード再設定メールを送信します。
設定新密碼|Set a new password|새 비밀번호 설정|新しいパスワードを設定
新密碼|New password|새 비밀번호|新しいパスワード
儲存密碼|Save password|비밀번호 저장|パスワードを保存
密碼已更新|Password updated|비밀번호 변경 완료|パスワードを更新しました
請先登入。|Please sign in.|먼저 로그인하세요.|ログインしてください。
`;
const dictionary = new Map(rows.trim().split('\n').map(row => {const [key,...values]=row.split('|'); return [key,values];}));
const fragmentKeys=[...dictionary.keys()].filter(key=>key.length>=3||['台：','韓：','農曆','韓曆','補假','補班','放假'].includes(key)).sort((a,b)=>b.length-a.length);
const fragmentPattern=new RegExp(fragmentKeys.map(key=>key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g');
export function t(text) {
  if (language === 'zh-Hant' || typeof text !== 'string') return text;
  const index = {en:0,ko:1,ja:2}[language];
  if(dictionary.has(text)) return dictionary.get(text)[index];
  let match=text.match(/^還有 (\d+) 天$/);
  if(match) return [`In ${match[1]} day${match[1]==='1'?'':'s'}`,`${match[1]}일 후`,`${match[1]}日後`][index];
  match=text.match(/^＋其他 (\d+) 團$/);
  if(match) return [`＋${match[1]} more group${match[1]==='1'?'':'s'}`,`＋다른 ${match[1]}개 그룹`,`＋他${match[1]}組`][index];
  match=text.match(/^(.*?) (\d+) 場直播$/);
  if(match) return [`${match[1]}: ${match[2]} stream${match[2]==='1'?'':'s'}`,`${match[1]}: 방송 ${match[2]}개`,`${match[1]}：${match[2]}件の配信`][index];
  match=text.match(/^查看 (.*?) 團體照片$/);
  if(match)return [`View ${match[1]} group photo`,`${match[1]} 그룹 사진 보기`,`${match[1]}のグループ写真を見る`][index];
  match=text.match(/^行政年曆：(\d+)–(\d+) 年。$/);
  if(match)return [`Public calendar: ${match[1]}–${match[2]}.`,`공휴일 달력: ${match[1]}–${match[2]}년.`,`行政カレンダー：${match[1]}～${match[2]}年。`][index];
  match=text.match(/^(\d+) \/ 100 字$/);
  if(match)return [`${match[1]} / 100 characters`,`${match[1]} / 100자`,`${match[1]} / 100文字`][index];
  match=text.match(/^([ ·🎂]*)生日([ ·]*)$/u);
  if(match)return match[1]+dictionary.get('生日')[index]+match[2];
  match=text.match(/^(\d+) 年 (\d+) 月(?: (\d+) 日)?$/);
  if(match) return new Intl.DateTimeFormat(locale(),{year:'numeric',month:'long',...(match[3]?{day:'numeric'}:{}),timeZone:'UTC'}).format(new Date(Date.UTC(+match[1],+match[2]-1,+(match[3]||1))));
  match=text.match(/^(\d+) 歲生日$/);
  if(match)return [`${match[1]}th birthday`,`${match[1]}번째 생일`,`${match[1]}歳の誕生日`][index];
  match=text.match(/^(出道 )?(\d+) 週年$/);
  if(match)return [`${match[2]}-year ${match[1]?'debut ':''}anniversary`,`${match[1]?'데뷔 ':''}${match[2]}주년`,`${match[1]?'デビュー':''}${match[2]}周年`][index];
  // Translate UI fragments around dates/icons, never arbitrary short characters.
  // One pass avoids translating a translation a second time.
  const digits={一:1,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10,正:1,冬:11,臘:12};
  const number=value=>digits[value]|| (value.startsWith('初')?digits[value.slice(1)]:value==='二十'||value==='廿'?20:value==='三十'?30:value.startsWith('廿')?20+digits[value.slice(1)]:value.startsWith('十')?10+digits[value.slice(1)]:0);
  const lunar=text.replace(/(農曆|韓曆|台：|韓：)(閏?)(正|冬|臘|十一|十二|[一二三四五六七八九十])月(初[一二三四五六七八九十]|十[一二三四五六七八九]?|二十|廿[一二三四五六七八九]?|三十)/g,(_,prefix,leap,month,day)=>`${t(prefix)}${leap?t('閏'):''}${number(month)}/${number(day)}`);
  return lunar.replace(fragmentPattern,key=>dictionary.get(key)[index]);
}
const protectedSelector = '[data-user-content],#site-name,#site-credit,script,style,textarea,[contenteditable]';
export function initLanguage(doc, onChange = () => {}) {
  const originals = new WeakMap();
  function translateNode(node) {
    const parent=node.parentElement;
    if(!parent || parent.closest(protectedSelector)) return;
    // A label may be translated; a stored group/member/category option must not be.
    if(parent.tagName==='OPTION' && parent.value && parent.closest('#language-switch,#admin-group,#admin-creator,[name="group_id"],[name="member_id"],[name="member_ids"]')) return;
    const previous=originals.get(node), current=node.nodeValue;
    const source=previous && current===previous.translated ? previous.source : current;
    const trimmed=source.trim(), translated=source.replace(trimmed,t(trimmed));
    originals.set(node,{source,translated});
    if(current!==translated) node.nodeValue=translated;
  }
  const attributes=new WeakMap();
  function translate(root) {
    const walker=doc.createTreeWalker(root,4); let node;
    while((node=walker.nextNode())) translateNode(node);
    const elements=[...(root.nodeType===1?[root]:[]),...(root.querySelectorAll?.('[placeholder],[aria-label],[title]')||[])];
    for(const el of elements) {if(el.closest(protectedSelector))continue;let saved=attributes.get(el)||{};
      for(const key of ['placeholder','aria-label','title']) {if(!el.hasAttribute(key))continue;const value=el.getAttribute(key),prior=saved[key],source=prior&&value===prior.translated?prior.source:value,translated=t(source);saved[key]={source,translated};if(value!==translated)el.setAttribute(key,translated);}
      attributes.set(el,saved);
    }
  }
  const select=doc.querySelector('#language-switch');
  function apply() {doc.documentElement.lang=language;select.value=language;translate(doc.body);}
  select.addEventListener('change',()=>{setLanguage(select.value);onChange();apply();});
  const observer=new MutationObserver(records=>{for(const record of records){if(record.type==='characterData')translateNode(record.target);else if(record.type==='attributes')translate(record.target);else for(const node of record.addedNodes){if(node.nodeType===3)translateNode(node);else if(node.nodeType===1)translate(node);}}});
  apply(); observer.observe(doc.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label']});
  return {translate:()=>translate(doc.body),disconnect:()=>observer.disconnect()};
}
