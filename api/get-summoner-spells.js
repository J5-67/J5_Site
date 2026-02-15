export default async function handler(req, res) {
  let { summonerName, tagLine } = req.query;
  const API_KEY = process.env.RIOT_API_KEY;

  if (!API_KEY) {
      return res.status(200).json({ error: 'no_key', tier: "설정오류", record: "Vercel 키 등록 확인" });
  }

  // [유니] 문서 권장 사항: API 키를 헤더에 포함하여 안전하게 전달
  const headers = {
    "X-Riot-Token": API_KEY,
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Charset": "application/x-www-form-urlencoded; charset=UTF-8"
  };

  try {
    // 1. Account-v1: Riot ID로 PUUID 조회 (ASIA 라우팅 사용)
    // 띄어쓰기가 포함된 gameName을 encodeURIComponent로 안전하게 변환해!
    const accountUrl = `https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(summonerName.trim())}/${encodeURIComponent(tagLine.trim().replace('#',''))}`;
    const accountRes = await fetch(accountUrl, { headers });
    
    if (accountRes.status === 403) return res.status(200).json({ error: 'forbidden', tier: "권한거부", record: "API 키 재발급 및 Vercel 재배포 필요" });
    if (!accountRes.ok) throw new Error('계정 조회 실패');

    const accountData = await accountRes.json();
    const puuid = accountData.puuid;

    // 2. Summoner-v4: PUUID로 Summoner ID 조회 (KR 라우팅 사용)
    const summonerRes = await fetch(`https://kr.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`, { headers });
    const summonerData = await summonerRes.json();
    const id = summonerData.id;

    // 3. League-v4: 리그 정보 조회 (승패 데이터 추출)
    const leagueRes = await fetch(`https://kr.api.riotgames.com/lol/league/v4/entries/by-summoner/${id}`, { headers });
    const leagueData = await leagueRes.json();
    
    let tierInfo = "UNRANKED", record = "전적 없음";
    if (Array.isArray(leagueData) && leagueData.length > 0) {
        // 솔로랭크 정보를 우선적으로 필터링해
        const solo = leagueData.find(e => e.queueType === 'RANKED_SOLO_5x5') || leagueData[0];
        tierInfo = `${solo.tier} ${solo.rank}`;
        record = `${solo.wins}승 ${solo.losses}패`;
    }

    // 4. Spectator-v5: 실시간 게임 정보 확인
    let gameData = { error: 'not_in_game' };
    const gameRes = await fetch(`https://kr.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${puuid}`, { headers });
    if (gameRes.ok) {
        const live = await gameRes.json();
        gameData = { ...live, error: null };
    }

    res.status(200).json({ ...gameData, tier: tierInfo, record: record });

  } catch (error) {
    res.status(200).json({ error: 'server_error', tier: "에러", record: error.message });
  }
}
