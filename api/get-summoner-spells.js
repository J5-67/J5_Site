export default async function handler(req, res) {
  let { summonerName, tagLine } = req.query;
  const API_KEY = process.env.RIOT_API_KEY;

  if (!API_KEY) return res.status(200).json({ error: 'no_key', tier: "설정오류", record: "Vercel 키 확인" });

  const headers = { "X-Riot-Token": API_KEY };

  try {
    // 1. Account-v1 (ASIA 라우팅 필수!)
    const accountUrl = `https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(summonerName.trim())}/${encodeURIComponent(tagLine.trim().replace('#',''))}`;
    const accountRes = await fetch(accountUrl, { headers });
    
    if (accountRes.status === 403) return res.status(200).json({ error: 'forbidden', tier: "권한거부", record: "API 키 재발행 필요" });
    const accountData = await accountRes.json();
    if (!accountData.puuid) return res.status(200).json({ error: 'not_found', tier: "미검색", record: "닉네임 확인 요망" });

    const puuid = accountData.puuid;

    // 2. Summoner-v4 (KR 라우팅)
    const summonerRes = await fetch(`https://kr.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`, { headers });
    const summonerData = await summonerRes.json();
    const id = summonerData.id;

    // 3. League-v4 (KR 라우팅 - 랭크 및 전적)
    const leagueRes = await fetch(`https://kr.api.riotgames.com/lol/league/v4/entries/by-summoner/${id}`, { headers });
    const leagueData = await leagueRes.json();
    
    let tierInfo = "UNRANKED", record = "전적 없음";
    // [유니 팁] 배열이 비어있지 않은지 꼼꼼하게 체크!
    if (Array.isArray(leagueData) && leagueData.length > 0) {
        const target = leagueData.find(e => e.queueType === 'RANKED_SOLO_5x5') || leagueData[0];
        tierInfo = `${target.tier} ${target.rank}`;
        record = `${target.wins}승 ${target.losses}패`;
    }

    // 4. Spectator-v5 (KR 라우팅 - 인게임 정보)
    let gameData = { error: 'not_in_game' };
    const gameRes = await fetch(`https://kr.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${puuid}`, { headers });
    
    if (gameRes.ok) {
        const live = await gameRes.json();
        // [유니 팁] 실시간 게임 데이터를 그대로 넘겨주되, puuid를 명시해줘서 클라이언트가 찾게 해!
        gameData = { ...live, puuid: puuid, error: null };
    }

    res.status(200).json({ ...gameData, tier: tierInfo, record: record });

  } catch (error) {
    res.status(200).json({ error: 'server_error', tier: "에러", record: error.message });
  }
}
