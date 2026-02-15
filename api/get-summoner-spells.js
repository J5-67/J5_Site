export default async function handler(req, res) {
  const { summonerName, tagLine } = req.query;
  const API_KEY = process.env.RIOT_API_KEY;

  try {
    // 1. Account-v1: PUUID 가져오기
    const accountRes = await fetch(`https://asia.api.riotgames.com/riot/account/v1/accounts/by-game-name/${encodeURIComponent(summonerName)}/${encodeURIComponent(tagLine)}?api_key=${API_KEY}`);
    const accountData = await accountRes.json();
    const puuid = accountData.puuid;

    if (!puuid) {
        return res.status(404).json({ error: '소환사를 찾을 수 없어 오빠 ㅠㅠ' });
    }

    // 2. Summoner-v4: ID 가져오기
    const summonerRes = await fetch(`https://kr.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}?api_key=${API_KEY}`);
    const summonerData = await summonerRes.json();
    const id = summonerData.id;

    // 3. League-v4: 리그 정보 및 승패 데이터 가져오기
    const leagueRes = await fetch(`https://kr.api.riotgames.com/lol/league/v4/entries/by-summoner/${id}?api_key=${API_KEY}`);
    const leagueData = await leagueRes.json();
    
    // [유니 팁] 배열을 돌면서 솔랭(RANKED_SOLO_5x5)을 최우선으로 찾기!
    let targetRank = leagueData.find(entry => entry.queueType === 'RANKED_SOLO_5x5');
    if (!targetRank) {
        targetRank = leagueData.find(entry => entry.queueType === 'RANKED_FLEX_SR');
    }

    const tierInfo = targetRank ? `${targetRank.tier} ${targetRank.rank}` : "UNRANKED";
    const record = targetRank ? `${targetRank.wins}승 ${targetRank.losses}패` : "전적 없음";

    // 4. Spectator-v5: 실시간 게임 정보 확인
    const gameRes = await fetch(`https://kr.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${puuid}?api_key=${API_KEY}`);
    const gameData = await gameRes.json();

    // [유니] 게임 중이든 아니든, 찾은 티어와 승패 정보는 무조건 보내줘!
    if (gameRes.ok) {
        res.status(200).json({ ...gameData, puuid, tier: tierInfo, record: record });
    } else {
        res.status(200).json({ error: 'not_in_game', tier: tierInfo, record: record });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'fetch_failed', tier: "정보 없음", record: "" });
  }
}
